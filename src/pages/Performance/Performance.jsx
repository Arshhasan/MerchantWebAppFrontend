import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { resolveOrderVendorId, computeOrderPayableTotal } from '../../services/orderSchema';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { getVendorOrdersOnce } from '../../services/orderQuery';
import { getAdminCommissionSettings, merchantNetFromGross } from '../../services/adminCommission';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './Performance.css';

const TIME_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7days' },
  { label: '30 Days', value: '30days' },
];

// Environmental impact factors per sold bag.
const WASTE_SAVED_PER_BAG_KG = 0.5;
const CO2_SAVED_PER_BAG_KG = 1.2;

const Performance = () => {
  const navigate = useNavigate();
  const { user, userProfile, vendorProfile } = useAuth();
  const [activeFilter, setActiveFilter] = useState('today');
  const [loadingStats, setLoadingStats] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBagsSold, setTotalBagsSold] = useState(0);
  const [wasteSavedKg, setWasteSavedKg] = useState(0);
  const [co2SavedKg, setCo2SavedKg] = useState(0);
  const [bestSellingSlots, setBestSellingSlots] = useState([]);

  const statCards = useMemo(
    () => [
      {
        label: 'Total Revenue (after commission)',
        value: formatMerchantCurrency(totalRevenue, vendorProfile),
        color: 'stat-dark-green',
      },
      { label: 'Total Bags Sold', value: totalBagsSold.toString(), color: 'stat-yellow' },
      { label: 'Waste Saved (Kg)', value: `${wasteSavedKg.toFixed(1)} kg`, color: 'stat-blue' },
      { label: 'CO₂ Impact Saved', value: `${co2SavedKg.toFixed(1)} kg`, color: 'stat-coral' },
    ],
    [totalRevenue, totalBagsSold, wasteSavedKg, co2SavedKg, vendorProfile]
  );

  // Derive date range:
  // - If both From/To are selected, always honor that explicit range.
  // - Otherwise, fall back to the active quick filter tab.
  const computedDateRange = useMemo(() => {
    const now = new Date();

    const startOfDay = (d) => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };

    const endOfDay = (d) => {
      const copy = new Date(d);
      copy.setHours(23, 59, 59, 999);
      return copy;
    };

    if (activeFilter === 'today') {
      return { from: startOfDay(now), to: endOfDay(now) };
    }

    if (activeFilter === '7days') {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }

    if (activeFilter === '30days') {
      const from = new Date(now);
      from.setDate(now.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    }

    return { from: null, to: null };
  }, [activeFilter]);

  // Fetch stats from Firestore restaurant_orders
  useEffect(() => {
    const getHourFromOrder = (data) => {
      const from = data.pickupTimeFrom || data.pickup_time_from || '';
      if (typeof from === 'string' && /^\d{1,2}:\d{2}$/.test(from)) {
        return parseInt(from.split(':')[0], 10);
      }

      const range = data.pickupTime || data.pickup_time || '';
      if (typeof range === 'string') {
        const first = range.split('-')[0]?.trim();
        if (first && /^\d{1,2}:\d{2}$/.test(first)) {
          return parseInt(first.split(':')[0], 10);
        }
      }

      return null;
    };

    const formatHourSlot = (hour) => {
      const h = String(hour).padStart(2, '0');
      return `${h}:00 - ${h}:59`;
    };

    const fetchStats = async () => {
      const merchantVendorId = userProfile?.vendorID || await resolveMerchantVendorId(user?.uid);
      const vendorCandidates = new Set([merchantVendorId, user?.uid].filter(Boolean));
      if (vendorCandidates.size === 0) {
        setTotalRevenue(0);
        setTotalBagsSold(0);
        setWasteSavedKg(0);
        setCo2SavedKg(0);
        setBestSellingSlots([]);
        return;
      }

      setLoadingStats(true);

      try {
        const [orders, commissionSettings] = await Promise.all([
          getVendorOrdersOnce([merchantVendorId, user?.uid]),
          getAdminCommissionSettings(),
        ]);

        let revenue = 0;
        let bags = 0;
        let wasteSaved = 0;
        let co2Saved = 0;
        const slotMap = new Map();

        orders.forEach((data) => {
          if (!vendorCandidates.has(resolveOrderVendorId(data))) return;

          // Consider only non-cancelled / non-rejected orders
          const status = (data.status || '').toLowerCase();
          if (
            status.includes('cancel') ||
            status.includes('reject')
          ) {
            return;
          }

          // Filter by date range if available
          const createdAt =
            data.createdAt?.toDate?.() ??
            (data.createdAt ? new Date(data.createdAt) : null);

          if (computedDateRange.from && computedDateRange.to && createdAt) {
            if (createdAt < computedDateRange.from || createdAt > computedDateRange.to) {
              return;
            }
          }

          const orderTotal = computeOrderPayableTotal(data);
          const netTotal = merchantNetFromGross(orderTotal, commissionSettings);
          revenue += netTotal;

          // Bags sold: sum of quantities (default 1 per product)
          const products = Array.isArray(data.products) ? data.products : [];
          const orderBags = products.reduce((sum, p) => {
            const qty = parseInt(p.quantity || 1, 10);
            return sum + qty;
          }, 0);

          const bagsInOrder = orderBags || 1; // fallback: count at least 1 bag per order
          bags += bagsInOrder;
          wasteSaved += bagsInOrder * WASTE_SAVED_PER_BAG_KG;
          co2Saved += bagsInOrder * CO2_SAVED_PER_BAG_KG;

          // Aggregate best-selling time slots by pickup "from" hour.
          const hour = getHourFromOrder(data);
          if (hour !== null && hour >= 0 && hour <= 23) {
            const key = formatHourSlot(hour);
            const previous = slotMap.get(key) || { slot: key, orders: 0, bagsSold: 0, revenue: 0 };
            previous.orders += 1;
            previous.bagsSold += bagsInOrder;
            previous.revenue += netTotal;
            slotMap.set(key, previous);
          }
        });

        setTotalRevenue(revenue);
        setTotalBagsSold(bags);
        setWasteSavedKg(wasteSaved);
        setCo2SavedKg(co2Saved);
        const sortedSlots = Array.from(slotMap.values())
          .sort((a, b) => {
            if (b.orders !== a.orders) return b.orders - a.orders;
            if (b.bagsSold !== a.bagsSold) return b.bagsSold - a.bagsSold;
            return b.revenue - a.revenue;
          })
          .slice(0, 10)
          .map((slotData) => ({
            ...slotData,
            revenue: Number(slotData.revenue.toFixed(2)),
          }));
        setBestSellingSlots(sortedSlots);
      } catch (error) {
        console.error('Error fetching performance stats:', error);
        setTotalRevenue(0);
        setTotalBagsSold(0);
        setWasteSavedKg(0);
        setCo2SavedKg(0);
        setBestSellingSlots([]);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user, userProfile, computedDateRange]);

  return (
    <div className="performance-page">
      {/* Green Header with Back Arrow */}
      <div className="perf-header">
        <button className="perf-back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="perf-title">Performance Overview</h1>
      </div>

      {/* Time Filter Tabs */}
      <div className="perf-filter-tabs">
        {TIME_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`perf-filter-tab${activeFilter === f.value ? ' active' : ''}`}
            onClick={() => setActiveFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats Section */}
      <div className="perf-section">
        <h2 className="perf-section-title">Stats</h2>
        {loadingStats && (
          <p className="perf-loading">Loading stats from your orders...</p>
        )}
        <div className="perf-stats-grid">
          {statCards.map((card) => (
            <div key={card.label} className={`perf-stat-card ${card.color}`}>
              <span className="perf-stat-label">{card.label}</span>
              <span className="perf-stat-value">{card.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Best Selling Time Slots */}
      <div className="perf-section">
        <h2 className="perf-section-title">Best Selling Time Slots</h2>
        <p className="perf-timeslot-hint">Based on the period selected above (Today, 7 Days, or 30 Days).</p>

        {/* Time slots result area */}
        <div className="perf-timeslot-results">
          {bestSellingSlots.length === 0 ? (
            <p className="perf-no-data">No data available for selected period.</p>
          ) : (
            <table className="perf-timeslot-table">
              <thead>
                <tr>
                  <th>Time Slot</th>
                  <th>Orders</th>
                  <th>Bags Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestSellingSlots.map((slot) => (
                  <tr key={slot.slot}>
                    <td>{slot.slot}</td>
                    <td>{slot.orders}</td>
                    <td>{slot.bagsSold}</td>
                    <td>{formatMerchantCurrency(slot.revenue, vendorProfile)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Performance;
