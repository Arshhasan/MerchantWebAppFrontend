// Mock Data for the application

export const dashboardKPIs = {
  totalEarnings: 12500,
  bagsSoldToday: 45,
  pendingPickups: 12,
  cancelledOrders: 3,
};

export const recentOrders = [
  {
    id: 'ORD001',
    customerName: 'John Doe',
    bagName: 'Surprise Bag #1',
    pickupTime: '10:00 AM',
    status: 'Pending',
    amount: 25.99,
  },
  {
    id: 'ORD002',
    customerName: 'Jane Smith',
    bagName: 'Surprise Bag #2',
    pickupTime: '11:30 AM',
    status: 'Confirmed',
    amount: 30.50,
  },
  {
    id: 'ORD003',
    customerName: 'Bob Johnson',
    bagName: 'Surprise Bag #3',
    pickupTime: '2:00 PM',
    status: 'Completed',
    amount: 20.00,
  },
  {
    id: 'ORD004',
    customerName: 'Alice Williams',
    bagName: 'Surprise Bag #4',
    pickupTime: '3:30 PM',
    status: 'Pending',
    amount: 35.75,
  },
];

export const allOrders = [
  ...recentOrders,
  {
    id: 'ORD005',
    customerName: 'Charlie Brown',
    bagName: 'Surprise Bag #5',
    pickupTime: '4:00 PM',
    status: 'Cancelled',
    amount: 28.00,
  },
  {
    id: 'ORD006',
    customerName: 'Diana Prince',
    bagName: 'Surprise Bag #6',
    pickupTime: '5:00 PM',
    status: 'Completed',
    amount: 22.50,
  },
  {
    id: 'ORD007',
    customerName: 'Edward Norton',
    bagName: 'Surprise Bag #7',
    pickupTime: '6:00 PM',
    status: 'Active',
    amount: 40.00,
  },
];

export const categories = [
  'Food & Beverages',
  'Electronics',
  'Clothing',
  'Books',
  'Home & Garden',
  'Sports',
  'Beauty',
  'Toys',
];

export const timeSlots = [
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
];

export const staffMembers = [
  {
    id: 1,
    name: 'John Manager',
    email: 'john@example.com',
    role: 'Manager',
    phone: '+1234567890',
  },
  {
    id: 2,
    name: 'Sarah Staff',
    email: 'sarah@example.com',
    role: 'Staff',
    phone: '+1234567891',
  },
  {
    id: 3,
    name: 'Mike Helper',
    email: 'mike@example.com',
    role: 'Helper',
    phone: '+1234567892',
  },
];

export const orderHistory = [
  {
    id: 'ORD001',
    date: '2024-01-15',
    customerName: 'John Doe',
    bagName: 'Surprise Bag #1',
    amount: 25.99,
    status: 'Completed',
  },
  {
    id: 'ORD002',
    date: '2024-01-14',
    customerName: 'Jane Smith',
    bagName: 'Surprise Bag #2',
    amount: 30.50,
    status: 'Completed',
  },
];

export const complaints = [
  {
    id: 1,
    orderId: 'ORD001',
    customerName: 'John Doe',
    complaint: 'Bag was damaged',
    date: '2024-01-15',
    status: 'Pending',
  },
  {
    id: 2,
    orderId: 'ORD002',
    customerName: 'Jane Smith',
    complaint: 'Wrong items in bag',
    date: '2024-01-14',
    status: 'Resolved',
  },
];

export const reviews = [
  {
    id: 1,
    orderId: 'ORD001',
    customerName: 'John Doe',
    rating: 5,
    comment: 'Great surprise bag!',
    date: '2024-01-15',
  },
  {
    id: 2,
    orderId: 'ORD002',
    customerName: 'Jane Smith',
    rating: 4,
    comment: 'Good value for money',
    date: '2024-01-14',
  },
];

export const payoutHistory = [
  {
    id: 1,
    date: '2024-01-15',
    amount: 5000,
    status: 'Completed',
    transactionId: 'TXN001',
  },
  {
    id: 2,
    date: '2024-01-10',
    amount: 3000,
    status: 'Completed',
    transactionId: 'TXN002',
  },
  {
    id: 3,
    date: '2024-01-05',
    amount: 4500,
    status: 'Pending',
    transactionId: 'TXN003',
  },
];

export const invoices = [
  {
    id: 'INV001',
    date: '2024-01-15',
    amount: 12500,
    tax: 1250,
    total: 13750,
    status: 'Paid',
  },
  {
    id: 'INV002',
    date: '2024-01-10',
    amount: 10000,
    tax: 1000,
    total: 11000,
    status: 'Paid',
  },
  {
    id: 'INV003',
    date: '2024-01-05',
    amount: 15000,
    tax: 1500,
    total: 16500,
    status: 'Pending',
  },
];

export const chartData = [
  { time: '9 AM', sales: 5 },
  { time: '10 AM', sales: 8 },
  { time: '11 AM', sales: 12 },
  { time: '12 PM', sales: 15 },
  { time: '1 PM', sales: 10 },
  { time: '2 PM', sales: 7 },
  { time: '3 PM', sales: 9 },
  { time: '4 PM', sales: 11 },
  { time: '5 PM', sales: 13 },
  { time: '6 PM', sales: 6 },
];
