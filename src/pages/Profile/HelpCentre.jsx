import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './BlankPage.css';

const faqs = [
  {
    question: 'How do I create a surprise bag?',
    answer:
      'Go to the Create Bag section from your dashboard, fill in the bag details such as items, quantity, price, and pickup window, then publish it. Your bag will immediately be visible to customers.',
  },
  {
    question: 'Can I edit or cancel a bag after it is published?',
    answer:
      'Yes. As long as the pickup time has not started, you can edit or cancel a bag from the Bags or Orders section. Customers will be notified automatically of any changes.',
  },
  {
    question: 'When do I get paid for my orders?',
    answer:
      'Payouts are processed according to your payout schedule, typically within 2–3 business days after completed pickups. You can see the breakdown under Accounting → Payout.',
  },
  {
    question: 'What should I do if a customer does not show up?',
    answer:
      'Mark the order as a no‑show from the Orders section so it is recorded correctly. Depending on your cancellation policy, the customer may not be refunded.',
  },
  {
    question: 'How can I contact support?',
    answer:
      'If you still need help, submit a ticket via the Complaints section or email merchants@bestbybites.com and our support team will get back to you.',
  },
];

const HelpCentre = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState(0);

  const toggleFaq = (index) => {
    setOpenIndex((current) => (current === index ? -1 : index));
  };

  return (
    <div className="blank-page">
      <div className="green-app-header help-centre-green-header">
        <button type="button" className="back-button" onClick={() => navigate(-1)} aria-label="Back">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 18L9 12L15 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1>Help Centre</h1>
        <span className="green-app-header__spacer" aria-hidden="true" />
      </div>

      <div className="blank-page-content help-centre-content">
        <p className="help-centre-intro">
          Find quick answers to the most common questions about using your BestByBites
          merchant account.
        </p>

        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`faq-item ${openIndex === index ? 'open' : ''}`}
            >
              <button
                className="faq-question"
                onClick={() => toggleFaq(index)}
                type="button"
              >
                <span>{faq.question}</span>
                <span className="faq-icon">{openIndex === index ? '−' : '+'}</span>
              </button>
              {openIndex === index && (
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpCentre;

