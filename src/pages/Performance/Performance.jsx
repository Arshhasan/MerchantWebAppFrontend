import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { resolveOrderVendorId } from '../../services/orderSchema';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { getVendorOrdersOnce } from '../../services/orderQuery';
import './Performance.css';

const TIME_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7days' },
  { label: '30 Days', value: '30days' },
  { label: 'Custom', value: 'custom' },
];

const Performance = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [activeFilter, setActiveFilter] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loadingStats, setLoadingStats] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBagsSold, setTotalBagsSold] = useState(0);

  const statCards = useMemo(
    () => [
      { label: 'Total Revenue', value: `€${totalRevenue.toFixed(2)}`, color: 'stat-dark-green' },
      { label: 'Total Bags Sold', value: totalBagsSold.toString(), color: 'stat-yellow' },
      { label: 'Waste Saved (Kg)', value: '0 kg', color: 'stat-blue' },
      { label: 'CO₂ Impact Saved', value: '0 kg', color: 'stat-coral' },
    ],
    [totalRevenue, totalBagsSold]
  );

  // Derive date range based on active filter
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

    if (activeFilter === 'custom' && fromDate && toDate) {
      return { from: startOfDay(new Date(fromDate)), to: endOfDay(new Date(toDate)) };
    }

    return { from: null, to: null };
  }, [activeFilter, fromDate, toDate]);

  // Fetch stats from Firestore restaurant_orders
  useEffect(() => {
    const fetchStats = async () => {
      const merchantVendorId = userProfile?.vendorID || await resolveMerchantVendorId(user?.uid);
      const vendorCandidates = new Set([merchantVendorId, user?.uid].filter(Boolean));
      if (vendorCandidates.size === 0) {
        setTotalRevenue(0);
        setTotalBagsSold(0);
        return;
      }

      setLoadingStats(true);

      try {
        const orders = await getVendorOrdersOnce([merchantVendorId, user?.uid]);

        let revenue = 0;
        let bags = 0;

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

          // Revenue: use explicit totalAmount if present, otherwise compute from products
          let orderTotal = 0;
          if (typeof data.totalAmount === 'number') {
            orderTotal = data.totalAmount;
          } else {
            const products = Array.isArray(data.products) ? data.products : [];
            const subtotal = products.reduce((sum, p) => {
              const price = parseFloat(p.price || 0);
              const qty = parseInt(p.quantity || 1, 10);
              return sum + price * qty;
            }, 0);
            const deliveryCharge = parseFloat(data.deliveryCharge || 0);
            const discount = parseFloat(data.discount || 0);
            const tipAmount = parseFloat(data.tip_amount || 0);
            orderTotal = subtotal + deliveryCharge - discount + tipAmount;
          }

          revenue += orderTotal;

          // Bags sold: sum of quantities (default 1 per product)
          const products = Array.isArray(data.products) ? data.products : [];
          const orderBags = products.reduce((sum, p) => {
            const qty = parseInt(p.quantity || 1, 10);
            return sum + qty;
          }, 0);

          bags += orderBags || 1; // fallback: count at least 1 bag per order
        });

        setTotalRevenue(revenue);
        setTotalBagsSold(bags);
      } catch (error) {
        console.error('Error fetching performance stats:', error);
        setTotalRevenue(0);
        setTotalBagsSold(0);
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
            <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
        <div className="perf-timeslot-row">
          <input
            type="date"
            className="perf-date-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="From"
          />
          <span className="perf-timeslot-from">from</span>
          <input
            type="date"
            className="perf-date-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="To"
          />
        </div>

        {/* Time slots result area */}
        <div className="perf-timeslot-results">
          <p className="perf-no-data">No data available for selected period.</p>
        </div>
      </div>
    </div>
  );
};

export default Performance;
