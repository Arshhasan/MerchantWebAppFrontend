import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './BlankPage.css';
import './LegalPolicies.css';

const TABS = [
  { id: 'privacy', label: 'Privacy policy' },
  { id: 'refund', label: 'Refund & cancellation' },
  { id: 'grievance', label: 'Grievance & contact' },
  { id: 'terms', label: 'Terms of use' },
];

const TAB_IDS = new Set(TABS.map((t) => t.id));

const POLICIES = {
  privacy: `BESTBYBITES USER PRIVACY POLICY
This Privacy Policy explains how BestByBites Private Limited (“BestByBites”, “we”, “our”, “us”)
collects, uses, stores, processes, and protects personal information of Users (“User”, “you”) who
access or use the BestByBites mobile application and website (“Platform”).
By registering or using the Platform, you expressly consent to the collection and use of your
information in accordance with this Privacy Policy and applicable laws of India.

1. INFORMATION WE COLLECT
1.1 Personal Information
We may collect:
• Name
• Phone number
• Email address
• Location data
• Device information
1.2 Transaction Information
• Order details
• Payment transaction records
• Pickup history
We do not store debit or credit card details. All payments are processed through secure
third-party payment gateways.
1.3 Technical Information
• IP address
• App usage data
• Log records
• Cookies and similar technologies

2. PURPOSE OF DATA COLLECTION
We collect User data to:
• Register and manage user accounts
• Process orders and pickups
• Communicate order updates and notifications
• Provide customer support
• Prevent fraud and misuse
• Improve Platform services
• Comply with legal and regulatory obligations

3. LEGAL BASIS FOR PROCESSING
User data is processed based on:
• User consent
• Performance of contractual obligations
• Compliance with applicable laws
• Legitimate business interests

4. DATA SHARING & DISCLOSURE
User data may be shared with:
• Merchants for order fulfillment
• Payment gateway providers
• Technology service providers
• Government or law enforcement authorities when required by law
BestByBites does not sell or rent User data to third parties.

5. DATA SECURITY
BestByBites implements reasonable administrative, technical, and physical safeguards to
protect User data against unauthorized access, loss, misuse, alteration, or disclosure.

6. DATA RETENTION
User data shall be retained only for as long as:
• Necessary to provide services
• Required by law
• Needed for dispute resolution and audit purposes
After account deletion, data may be retained as required by law and then securely deleted.

7. USER RIGHTS
Users have the right to:
• Access their personal data
• Request correction of inaccurate data
• Request deletion of their data (subject to legal obligations)
• Withdraw consent by discontinuing use of the Platform
• Raise complaints regarding data handling
Requests can be sent to: @bestbybites.com

8. CONFIDENTIALITY
BestByBites shall treat User information as confidential except where disclosure is required by
law or necessary for Platform operations.

9. DATA BREACH MANAGEMENT
In case of a data breach, BestByBites shall take reasonable steps to:
• Investigate and contain the breach
• Notify affected Users where required by law
• Implement corrective security measures

10. COOKIES & TRACKING
The Platform may use cookies or similar technologies to enhance user experience, analytics,
and system security.

11. CHILDREN’S PRIVACY
The Platform is intended only for users aged 18 years and above.
BestByBites does not knowingly collect personal data from minors.

12. THIRD-PARTY SERVICES
The Platform may contain links to third-party services (such as payment gateways). BestByBites
is not responsible for the privacy practices of such third parties.

13. CHANGES TO THIS PRIVACY POLICY
BestByBites reserves the right to update or modify this Privacy Policy at any time.
Continued use of the Platform constitutes acceptance of the revised Privacy Policy.

14. GOVERNING LAW
This Privacy Policy shall be governed by and interpreted in accordance with the laws of India,
including the Information Technology Act, 2000 and applicable data protection regulations.

15. GRIEVANCE / PRIVACY OFFICER
In accordance with Indian law, a Grievance & Privacy Officer is appointed:
Name: Piyush Kataria
Designation: Grievance & Privacy Officer
Email: support@bestbybites.com
All complaints shall be addressed within 15 working days.

16. CONTACT INFORMATION
BestByBites Private Limited
Email: support@bestbybites.com
`,

  terms: `User Terms & Conditions
1. ROLE OF BESTBYBITES
1.1 BestByBites is a technology platform that connects Customers with independent
food Merchants offering surplus food at discounted prices.
1.2 BestByBites does not prepare, cook, store, package, transport, or sell food.
1.3 The sale of food is strictly between the Merchant and the Customer.
1.4 BestByBites does not take ownership or responsibility for any food item listed on the
Platform.

2. USER ELIGIBILITY
2.1 Users must be at least 18 years of age to register and use the Platform.
2.2 If a minor uses the Platform through a parent or guardian’s account, the
parent/guardian shall be solely responsible for such use.
2.3 Users must provide true and accurate information.
2.4 BestByBites may suspend or terminate accounts for misuse or violation of these Terms.

3. NATURE OF FOOD
3.1 Food listed on the Platform is surplus food prepared during the Merchant’s normal business
operations.
3.2 Food may not be freshly prepared and is offered at discounted prices.
3.3 Quantity, quality, taste, and packaging may vary.
3.4 Availability of food is not guaranteed.

4. HEALTH & ALLERGY DISCLAIMER
4.1 Users with allergies, dietary restrictions, or medical conditions must verify ingredients
directly with the Merchant.
4.2 BestByBites is not responsible for allergic reactions, illness, or health consequences.
4.3 Consumption of food purchased through the Platform is entirely at the User’s own risk.

5. ORDER & PICKUP
5.1 Orders are confirmed upon successful payment and issuance of a pickup code.
5.2 Orders must be collected within the specified pickup window.
5.3 Failure to collect food within the pickup window shall be treated as a completed transaction
with no refund.

6. NO CANCELLATION POLICY
6.1 Orders once confirmed cannot be cancelled by the User due to the perishable nature
of surplus food.

7. REFUND POLICY
7.1 Refunds may be issued only if:
• Food is not provided by the Merchant
• Food is unsafe or spoiled
• Merchant cancels the order
7.2 No refunds shall be provided for:
• Late pickup
• Change of mind
• Taste dissatisfaction
• Portion size complaints
7.3 Approved refunds shall be processed within 7–10 working days to the original payment
method.

8. USER RESPONSIBILITIES
Users agree:
• To inspect food before consumption
• Not to resell food purchased
• Not to misuse the Platform
• Not to make false or fraudulent complaints
• To comply with all applicable laws

9. LIMITATION OF LIABILITY
9.1 BestByBites shall not be liable for:
• Food quality or safety
• Food poisoning
• Allergic reactions
• Merchant negligence
• Non-availability of food
9.2 BestByBites’ maximum liability shall not exceed the amount paid by the User for the specific
order.

10. CONSUMER LAW SAFEGUARD
Nothing in these Terms shall exclude or limit any statutory rights available to the Customer
under the Consumer Protection Act, 2019 or other applicable Indian laws.

11. INDEMNITY
The User agrees to indemnify and hold harmless BestByBites from any claims, damages,
losses, or legal proceedings arising out of:
• Food consumption
• Misuse of the Platform
• False complaints
• Violation of these Terms

12. NO WARRANTY
The Platform is provided on an “as is” and “as available” basis.
BestByBites makes no warranties regarding:
• Food quality
• Continuous service
• Availability of food

13. DATA PRIVACY
13.1 User data shall be collected and processed in accordance with BestByBites’ Privacy
Policy and applicable Indian IT and data protection laws.
13.2 Users consent to sharing necessary data with Merchants for order fulfillment.

14. INTELLECTUAL PROPERTY
All trademarks, logos, software, and content belong exclusively to BestByBites.
Users shall not copy, modify, or misuse Platform content.

15. SUSPENSION & TERMINATION
BestByBites may suspend or terminate User access without notice for:
• Fraud
• Abuse
• Misuse
• Legal risk
• Repeated violations

16. FORCE MAJEURE
Neither party shall be liable for failure due to events beyond reasonable control including natural
disasters, pandemics, government actions, or technical failures.

17. DISPUTE RESOLUTION & ARBITRATION
Any dispute shall first be resolved through mutual discussion.
If unresolved, the dispute shall be referred to arbitration under the Arbitration and
Conciliation Act, 1996.
Venue: [Your City, India].

18. GOVERNING LAW & JURISDICTION
These Terms shall be governed by the laws of India.
Courts at [Your City, India] shall have exclusive jurisdiction.

19. MODIFICATION OF TERMS
BestByBites may revise these Terms at any time.
Continued use of the Platform constitutes acceptance of revised Terms.

20. CONTACT INFORMATION
BestByBites Private Limited
Email: Support@bestbybites.com

21. ACCEPTANCE
By using the Platform, the User confirms that:
• They have read and understood these Terms
• They accept all risks associated with food consumption
• They agree to be bound by these Terms
These Terms & Conditions govern the use of the BestByBites mobile application and
website.
By accessing or using the Platform, the user agrees to be bound by these Terms.
`,

  refund: `USER REFUND & CANCELLATION POLICY
This Refund & Cancellation Policy governs refunds and cancellations for Users (“User”,
“Customer”) using the BestByBites mobile application and website (“Platform”).
By placing an order on the Platform, the User agrees to this Policy.

1. NO CANCELLATION POLICY
Due to the perishable nature of surplus food, orders once confirmed cannot be cancelled by
the User.

2. ELIGIBILITY FOR REFUND
Refunds shall be considered only in the following cases:
• Food is not provided by the Merchant
• Food is unsafe, spoiled, or unfit for consumption
• Merchant cancels the order
• Order cannot be fulfilled due to Merchant fault

3. NON-REFUNDABLE CASES
No refund shall be provided in the following situations:
• User fails to pick up food within the pickup time window
• Late pickup by User
• Change of mind after booking
• Taste dissatisfaction
• Portion size complaints
• User entered wrong order details
• User misuse of the Platform

4. REFUND REQUEST PROCESS
4.1 Refund issues must be reported within 24 hours of the scheduled pickup time.
4.2 Refund requests will be reviewed and verified with the Merchant.
4.3 BestByBites reserves the right to approve or reject refund requests after verification.

5. REFUND TIMELINE
Approved refunds shall be processed within 7–10 working days to the original payment method
used at the time of booking.

6. MODE OF REFUND
Refunds will be credited only to the original payment source (UPI / card / wallet / net banking).
Cash refunds shall not be provided.

7. PLATFORM ROLE
BestByBites acts only as a technology intermediary connecting Users and Merchants.
BestByBites does not prepare, cook, store, or sell food and is not responsible for food quality.

8. LIMITATION OF LIABILITY
BestByBites’ maximum liability shall not exceed the amount paid by the User for the specific
order.
BestByBites shall not be liable for indirect or consequential damages.

9. FRAUD & MISUSE
BestByBites reserves the right to deny refunds and suspend User accounts in case of:
• False refund claims
• Abuse of refund policy
• Fraudulent activity
• Repeated misuse

10. CONSUMER LAW SAFEGUARD
Nothing in this Policy shall limit statutory rights available to Users under the Consumer
Protection Act, 2019 or other applicable Indian laws.

11. MODIFICATION OF POLICY
BestByBites reserves the right to modify this Refund & Cancellation Policy at any time.
Continued use of the Platform constitutes acceptance of the revised Policy.

12. CONTACT INFORMATION
For refund-related queries, please contact:
BestByBites Private Limited
Email: support@bestbybites.com
`,

  grievance: `BESTBYBITES USER GRIEVANCE REDRESSAL & CONTACT POLICY
This Grievance Redressal & Contact Policy is issued in accordance with the Consumer
Protection (E-commerce) Rules, 2020 and applicable laws of India.

1. COMPANY DETAILS
Company Name: BestByBites Private Limited
Official Support Email: support@bestbybites.com

2. GRIEVANCE OFFICER DETAILS
In compliance with Indian law, BestByBites has appointed a Grievance Officer to address User
complaints and concerns.
Name: Piyush Kataria
Designation: Grievance & Privacy Officer
Email: Support@bestbybites.com

3. SCOPE OF GRIEVANCES
Users may raise grievances relating to:
• Order issues
• Refunds and cancellations
• Food safety concerns
• Account access problems
• Technical issues
• Data privacy concerns
• Policy violations
• Misuse of the Platform

4. HOW TO SUBMIT A GRIEVANCE
Users may submit grievances through:
• Email to: support@bestbybites.com
• In-app Help / Support section
Grievance submissions should include:
• Name of the User
• Registered phone number or email
• Order ID (if applicable)
• Description of the issue

5. ACKNOWLEDGEMENT & RESOLUTION
5.1 All grievances shall be acknowledged within 48 hours of receipt.
5.2 BestByBites shall make best efforts to resolve grievances within 15 working days from the
date of receipt.

6. ESCALATION
If the User is not satisfied with the resolution, the grievance may be escalated to senior
management of BestByBites for further review.

7. RECORD KEEPING
BestByBites shall maintain records of all grievances and actions taken for regulatory and audit
purposes.

8. CONFIDENTIALITY
All grievances and related information shall be handled confidentially and in accordance with
applicable data protection laws.

9. MODIFICATION OF POLICY
BestByBites reserves the right to modify this Grievance Redressal & Contact Policy at any time.
Continued use of the Platform constitutes acceptance of the revised policy.

10. GOVERNING LAW
This Policy shall be governed by and interpreted in accordance with the laws of India.
`,
};

const LegalPolicies = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeId = useMemo(() => {
    const raw = searchParams.get('tab');
    return raw && TAB_IDS.has(raw) ? raw : TABS[0].id;
  }, [searchParams]);

  const active = TABS.find((t) => t.id === activeId) ?? TABS[0];
  const content = POLICIES[active.id] || '';

  return (
    <div className="blank-page legal-policies">
      <div className="green-app-header legal-policies-green-header">
        <button type="button" className="back-button" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1>Legal</h1>
        <span className="green-app-header__spacer" aria-hidden="true" />
      </div>

      <div className="legal-policies__body">
        <div className="legal-policies__tabs" role="tablist" aria-label="Legal documents">
          {TABS.map((tab) => {
            const selected = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`legal-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`legal-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className={`legal-policies__tab${selected ? ' legal-policies__tab--active' : ''}`}
                onClick={() => setSearchParams({ tab: tab.id })}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          className="legal-policies__panel"
          role="tabpanel"
          id={`legal-panel-${active.id}`}
          aria-labelledby={`legal-tab-${active.id}`}
        >
          <article className="legal-policies__text" aria-label={active.label}>
            {content.split('\n').map((line, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <p key={`${active.id}-${idx}`}>{line || '\u00A0'}</p>
            ))}
          </article>
        </div>
      </div>
    </div>
  );
};

export default LegalPolicies;
