import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeCountryKey } from '../../utils/taxLabel';
import { fetchCountryCodeFromLatLng } from '../../utils/reverseGeocodeCountry';
import './BlankPage.css';
import './LegalPolicies.css';

const INDIA_TABS = [
  { id: 'privacy', label: 'Privacy policy' },
  { id: 'refund', label: 'Refund & cancellation' },
  { id: 'grievance', label: 'Grievance & contact' },
  { id: 'terms', label: 'Terms of use' },
];

const CANADA_TABS = [
  { id: 'merchantPrivacy', label: 'Merchant privacy policy' },
  { id: 'cookie', label: 'Cookie policy' },
  { id: 'storeTerms', label: 'Store terms & conditions' },
  { id: 'scheduleA', label: 'Schedule A – Commercial terms' },
];

function merchantCountryBucket(vendorProfile, merchantCurrencyCode, geoCountryCode) {
  const geo = normalizeCountryKey(geoCountryCode);
  if (geo === 'canada' || geo === 'india') return geo;

  const rawCountry =
    vendorProfile?.country ||
    vendorProfile?.storeCountry ||
    vendorProfile?.invoiceCountry ||
    vendorProfile?.countryName ||
    '';
  const rawCode = vendorProfile?.countryCode || '';
  const fromCountry = normalizeCountryKey(rawCountry) || normalizeCountryKey(rawCode);
  if (fromCountry === 'canada' || fromCountry === 'india') return fromCountry;
  const cur = String(merchantCurrencyCode || '').toUpperCase();
  if (cur === 'CAD') return 'canada';
  if (cur === 'INR') return 'india';
  return 'india';
}

const INDIA_POLICIES = {
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

const CANADA_POLICIES = {
  merchantPrivacy: `📄 BEST BY BITES – MERCHANT
PRIVACY POLICY
Version 1.0
Effective Date: March 18, 2026
1. INTRODUCTION
This Merchant Privacy Policy (“Policy”) describes how Best By Bites (“Best By Bites”, “we”, “us”,
“our”) collects, uses, discloses, stores, and protects personal information relating to Stores,
business owners, employees, contractors, and representatives (“Store”, “you”) in connection
with your use of our platform, including the merchant dashboard, mobile applications, and
related services (collectively, the “Platform”).
This Policy applies exclusively within Canada and is designed to comply with applicable
Canadian privacy legislation, including the Personal Information Protection and Electronic
Documents Act.
Best By Bites is responsible for personal information under its control and has implemented
policies and practices to ensure compliance with applicable privacy laws.
2. DEFINITIONS
For the purposes of this Policy:
● “Personal Information” means information about an identifiable individual as defined
under applicable law.
● “Store Data” means all information provided by or relating to the Store, including
operational and transactional data.
● “Customer Data” means personal information relating to end-users interacting with the
Store through the Platform.
3. SCOPE OF APPLICATION
3.1 This Policy applies to:
● Store account holders
● Employees, staff, or agents of a Store

-- 1 of 7 --

● Individuals acting on behalf of a business
3.2 This Policy does not apply to:
● End-users (customers), who are governed by a separate Privacy Policy
● Third-party platforms not controlled by Best By Bites
4. INFORMATION WE COLLECT
We collect only information that is reasonably necessary to operate, secure, and improve the
Platform.
4.1 Account & Identity Information
● Full name of owner or authorized representative
● Email address and phone number
● Store name, address, and business classification
● Role or position within the Store
● Account login credentials and identifiers
4.2 Financial & Tax Information
● Bank account details for payouts
● Payment account identifiers
● Tax registration numbers (including GST/HST where applicable)
● Billing and invoicing information
4.3 Transaction & Operational Data
● Order history, fulfillment records, cancellations
● Revenue, commission, payout, and settlement data
● Store performance metrics (ratings, complaints, reliability)
● Customer interaction records related to orders
4.4 Technical & Usage Information
● IP address and approximate location
● Device type, browser, and operating system
● Login timestamps and session activity
● Platform interaction patterns
4.5 Communication Data
● Emails, messages, chat logs, and support tickets

-- 2 of 7 --

● Phone call recordings (where consent is obtained)
● Feedback and survey responses
4.6 Information from Third Parties
We may collect information from:
● Payment processors
● Identity verification providers
● Public registries and business directories
5. PURPOSES OF COLLECTION AND USE
We use personal information strictly for legitimate business purposes.
5.1 Platform Operations
● Creating and managing Store accounts
● Enabling listing and sale of Surprise Bags
● Processing orders, payments, and payouts
5.2 Communication & Support
● Providing service updates and notifications
● Responding to inquiries and support requests
● Sending important operational messages
5.3 Performance Monitoring
● Evaluating Store performance
● Managing complaints and disputes
● Improving service quality and platform functionality
5.4 Security & Fraud Prevention
● Detecting unauthorized access
● Preventing fraud, abuse, or misuse
● Maintaining platform integrity
5.5 Legal & Regulatory Compliance
● Meeting legal obligations
● Responding to lawful requests
● Maintaining records for tax and audit purposes

-- 3 of 7 --

5.6 Marketing & Communications
Where permitted, we may send communications regarding:
● Platform updates
● Promotions and campaigns
👉 All such communications comply with Canada's Anti-Spam Legislation
6. LEGAL BASIS FOR PROCESSING (PIPEDA)
We rely on the following legal grounds:
● Your knowledge and consent
● Performance of contractual obligations
● Legitimate business interests
● Compliance with legal obligations
7. CONSENT
7.1 By registering and using the Platform, you consent to the collection, use, and disclosure of
your personal information as described in this Policy.
7.2 Express consent will be obtained where required, including for:
● Marketing communications
● Call recordings
7.3 You may withdraw consent at any time, subject to legal or contractual restrictions.
8. DISCLOSURE OF INFORMATION
We may disclose personal information in the following circumstances:
8.1 Service Providers
● Payment processors
● Cloud infrastructure providers
● Analytics and communication tools
All providers are contractually obligated to protect personal information.
8.2 Legal and Regulatory Authorities

-- 4 of 7 --

We may disclose information:
● To comply with applicable laws
● In response to valid legal requests
● To protect rights, safety, or property
8.3 Business Transfers
In the event of:
● Merger
● Acquisition
● Corporate restructuring
8.4 Internal Access
Access is limited to personnel who require it for legitimate business purposes.
9. INTERNATIONAL DATA TRANSFERS
Personal information may be stored or processed outside Canada.
Where such transfers occur, Best By Bites ensures appropriate safeguards are in place,
including contractual protections and security standards consistent with Canadian legal
requirements.
10. DATA RETENTION
We retain personal information only as long as necessary to:
● Maintain the Store account
● Fulfill contractual obligations
● Comply with legal, tax, or regulatory requirements
● Resolve disputes and enforce agreements
11. DATA SECURITY
We implement appropriate technical and organizational safeguards, including:
● Encryption and secure storage
● Access controls and authentication
● Monitoring and security protocols

-- 5 of 7 --

12. DATA BREACH MANAGEMENT
In the event of a breach posing a real risk of significant harm:
● Affected individuals will be notified
● Regulatory requirements will be followed
● Appropriate mitigation measures will be taken
13. YOUR RIGHTS
Under PIPEDA, you have the right to:
● Access your personal information
● Request correction of inaccurate data
● Withdraw consent (subject to limitations)
Requests will be handled within a reasonable timeframe.
14. CUSTOMER DATA RESTRICTIONS (FOR STORES)
The Store agrees that Customer Data accessed through the Platform:
● May only be used for fulfilling orders
● Must not be used for independent marketing or solicitation
● Must not be sold, shared, or disclosed outside permitted use
Any misuse may result in suspension or termination.
15. COOKIES & TRACKING TECHNOLOGIES
We use cookies and similar technologies to:
● Improve functionality and performance
● Analyze usage patterns
● Enhance user experience
You may control certain cookie settings through your browser.
16. AUTOMATED DECISION-MAKING
We may use automated systems for:

-- 6 of 7 --

● Fraud detection
● Risk assessment
● Performance evaluation
You may request information about such processing where applicable.
17. ACCOUNTABILITY & GOVERNANCE
Best By Bites has implemented internal policies, procedures, and safeguards to:
● Ensure compliance with privacy laws
● Train employees on data protection
● Monitor and audit data practices
18. CHANGES TO THIS POLICY
We may update this Policy from time to time.
Material changes will be communicated via:
● Email
● Platform notifications
Continued use of the Platform constitutes acceptance of updated terms.
19. CONTACT INFORMATION
For privacy-related inquiries, requests, or complaints:
Best By Bites
📧 support@bestbybites.com

-- 7 of 7 --
`,

  cookie: `📄 BEST BY BITES – COOKIE POLICY
(CANADA)
Version 1.0
Effective Date: March 18, 2026
1. INTRODUCTION
This Cookie Policy (“Policy”) explains in detail how Best By Bites (“Best By Bites”, “we”, “us”,
“our”) uses cookies and similar tracking technologies on our website, mobile applications, and
merchant dashboard (collectively, the “Platform”).
This Policy is intended to comply with Canadian privacy laws, including the Personal Information
Protection and Electronic Documents Act, and applicable electronic communications regulations
including Canada's Anti-Spam Legislation.
This Policy should be read together with our Privacy Policy and Merchant Privacy Policy.
2. WHAT ARE COOKIES AND TRACKING
TECHNOLOGIES
Cookies are small data files stored on your device when you access or use the Platform.
We also use similar technologies, including:
● Web beacons (invisible tracking elements)
● Pixels (used for analytics and advertising tracking)
● Local storage (browser-based data storage)
● Mobile SDKs (in-app tracking technologies)
These technologies allow us to recognize your device, store preferences, and collect
information about how you interact with the Platform.
3. TYPES OF COOKIES USED
We categorize cookies based on their purpose and function:
3.1 Strictly Necessary Cookies

-- 1 of 6 --

These cookies are essential for the operation of the Platform and cannot be disabled.
They are used to:
● Authenticate users and maintain secure sessions
● Enable core platform features (login, payments, dashboard access)
● Detect and prevent fraud or unauthorized access
● Maintain system stability and security
Legal basis: These cookies are used under legitimate interest and do not require consent.
3.2 Functional Cookies
These cookies enhance user experience by remembering choices and preferences.
They are used to:
● Store language, location, and display preferences
● Maintain user interface settings
● Enable personalized dashboard features
Legal basis: May require consent depending on functionality.
3.3 Analytics & Performance Cookies
These cookies collect information about how users interact with the Platform.
They are used to:
● Analyze traffic and user behavior
● Identify errors, bugs, and performance issues
● Improve Platform features and usability
● Measure engagement and conversion metrics
Data collected may include:
● Pages visited
● Session duration
● Click patterns
● Device and browser type
Legal basis: Consent may be required depending on implementation.
3.4 Advertising & Marketing Cookies
These cookies are used to deliver relevant advertising and measure marketing effectiveness.

-- 2 of 6 --

They are used to:
● Track user activity across websites and apps
● Deliver targeted advertising
● Measure campaign performance
● Retarget users with relevant promotions
Legal basis: These cookies are used only with consent where required.
4. FIRST-PARTY VS THIRD-PARTY COOKIES
4.1 First-Party Cookies
Set directly by Best By Bites and used for:
● Platform functionality
● Security
● Performance tracking
4.2 Third-Party Cookies
Placed by external service providers, including:
● Analytics providers (e.g., traffic analysis tools)
● Advertising networks
● Payment and fraud detection providers
These third parties may collect and process information according to their own privacy policies.
Best By Bites does not control third-party cookies but requires service providers to maintain
appropriate data protection standards.
5. PURPOSES OF USING COOKIES
We use cookies for the following purposes:
5.1 Platform Functionality
● Enable login and authentication
● Maintain session continuity
● Process transactions securely
5.2 Performance Optimization

-- 3 of 6 --

● Monitor system performance
● Identify technical issues
● Improve user experience
5.3 Security & Fraud Prevention
● Detect suspicious activity
● Prevent unauthorized access
● Protect user accounts
5.4 Analytics & Insights
● Understand user behavior
● Improve product design
● Optimize business operations
5.5 Marketing & Advertising
● Deliver relevant content and promotions
● Measure marketing campaign effectiveness
6. CONSENT MANAGEMENT
6.1 Where required under applicable law, we obtain your consent before placing non-essential
cookies.
6.2 Consent may be obtained through:
● Cookie banners
● Pop-ups or consent management tools
● Platform settings
6.3 Users may:
● Accept all cookies
● Reject non-essential cookies
● Customize cookie preferences
6.4 Consent can be withdrawn at any time by:
● Adjusting browser settings
● Using available consent tools
7. COOKIE CONTROL & USER CHOICES

-- 4 of 6 --

You may control or disable cookies through:
● Browser settings (Chrome, Safari, Firefox, etc.)
● Device privacy settings
● Cookie consent interfaces
Please note:
● Disabling cookies may impact Platform functionality
● Some services may not operate properly
8. DATA COLLECTED THROUGH COOKIES
Information collected through cookies may include:
● IP address
● Device identifiers
● Browser type and version
● Operating system
● Pages visited and navigation patterns
● Interaction data and timestamps
This information may be considered personal information under applicable Canadian law.
9. DATA RETENTION & STORAGE
Cookies may be stored as:
● Session cookies (deleted when session ends)
● Persistent cookies (stored for a defined duration)
Retention periods depend on:
● Purpose of the cookie
● Legal requirements
● Operational needs
10. INTERNATIONAL DATA TRANSFERS
Data collected via cookies may be processed or stored outside Canada.
Where such transfers occur, Best By Bites ensures appropriate safeguards, including:

-- 5 of 6 --

● Contractual protections
● Security standards consistent with Canadian requirements
11. DATA SECURITY
We implement appropriate safeguards to protect information collected through cookies,
including:
● Encryption
● Access controls
● Monitoring systems
● Secure storage mechanisms
12. COMPLIANCE & GOVERNANCE
Best By Bites maintains internal policies and procedures to:
● Ensure compliance with privacy laws
● Monitor cookie usage and third-party integrations
● Conduct periodic reviews and audits
13. UPDATES TO THIS POLICY
We may update this Cookie Policy periodically.
Material changes will be communicated via:
● Platform notifications
● Website updates
Continued use of the Platform constitutes acceptance of the updated Policy.
14. CONTACT INFORMATION
For questions or concerns regarding this Policy:
Best By Bites
📧 support@bestbybites.com

-- 6 of 6 --
`,

  storeTerms: `BEST BY BITES – STORE TERMS &
CONDITIONS (CANADA)
Version 1.0
Effective Date: March 18, 2026
1. INTRODUCTION
1.1 Best By Bites (“Best By Bites”, “we”, “us”, “our”) operates a digital platform that enables food
businesses to offer surplus food to consumers through discounted bundles known as “Surprise
Bags.”
1.2 These Terms form a legally binding agreement between Best By Bites and the Store.
1.3 By using the Platform, you confirm that:
● You are authorized to bind the Store
● You agree to these Terms
● You will comply with all applicable laws
2. PLATFORM ROLE
2.1 Best By Bites is a technology platform only.
2.2 Best By Bites does not:
● Sell, prepare, or supply food
● Take ownership of any products
● Control food safety or quality
2.3 All sales occur directly between the Store and Customer.
2.4 No partnership, agency, or employment relationship is created.
2.5 Best By Bites acts solely as a limited payment collection agent.
2.6 Any moderation or review of listings does not constitute responsibility for compliance.
3. SURPRISE BAGS

-- 1 of 11 --

3.1 Stores list surplus food as “Surprise Bags.”
3.2 Contents may vary and are not guaranteed.
3.3 A Reservation is not a completed sale.
3.4 A sale is completed only when:
● Customer arrives
● Code is verified
● Surprise Bag is handed over
3.5 Store is solely responsible for accuracy, quality, and compliance.
4. STORE ACCOUNT
4.1 Stores must provide accurate business and tax details.
4.2 Stores must maintain valid licenses.
4.3 Stores are responsible for all account activity.
4.4 Best By Bites may verify or suspend accounts.
5. LISTINGS
5.1 Only genuine surplus food may be listed.
5.2 Stores must not:
● Mislead customers
● Provide unsafe food
● Produce food specifically for the Platform
6. ORDERS & PICKUP
6.1 Stores must fulfill all orders during the pickup window.
6.2 Pickup Codes must be verified.
6.3 Failure may result in penalties, refunds, or suspension.
6.4 Best By Bites may restrict low-performing Stores.

-- 2 of 11 --

7. CANCELLATIONS
7.1 Stores must avoid cancellations.
7.2 No cancellation within 2 hours (except emergencies).
7.3 Repeated cancellations may result in penalties or removal.
8. FOOD SAFETY & LIABILITY
8.1 Store is solely responsible for all food.
8.2 Store must comply with:
● Food and Drugs Act
● Safe Food for Canadians Regulations
8.3 Store guarantees food safety and compliance.
8.4 Best By Bites does not inspect or control food.
8.5 Store is fully liable for:
● Illness
● Allergies
● Contamination
8.6 Store must maintain liability insurance.
8.7 Best By Bites is not liable except for gross negligence.
8.8 Best By Bites does not monitor food operations and relies entirely on Store compliance.
9. INCIDENTS, RECALLS & SAFETY EVENTS
9.1 The Store shall promptly notify Best By Bites in writing of any issue affecting safety or
legality of food.
9.2 The Store shall:
● Immediately cease offering affected Surprise Bags
● Mitigate risks
● Cooperate with authorities

-- 3 of 11 --

9.3 Best By Bites may:
● Remove Listings
● Cancel Reservations
● Notify Customers
● Issue refunds
● Suspend accounts
9.4 Such actions shall not create liability for Best By Bites.
10. PAYMENTS, FEES & FINANCIAL TERMS
10.1 Best By Bites facilitates payment processing as a limited agent.
10.2 Payment to Best By Bites constitutes payment to the Store.
10.3 Best By Bites may deduct fees, refunds, and adjustments.
10.4 No banking, escrow, or fiduciary services are provided.
10.5 Funds may be held and commingled.
10.6 Payouts may be delayed for fraud, disputes, or compliance.
10.7 Store is responsible for taxes.
11. REFUNDS, ADJUSTMENTS & DISPUTES
11.1 Best By Bites may, acting reasonably and in good faith, issue full or partial refunds to
Customers in circumstances including, but not limited to:
● A Surprise Bag is not fulfilled or made available for pickup
● The Customer is unable to collect the Surprise Bag due to Store error or unavailability
● The food provided is unsafe, expired, contaminated, or not fit for consumption
● The contents of the Surprise Bag are materially misrepresented or significantly below
reasonable expectations
● There is a verified complaint relating to hygiene, quality, or service
11.2 Best By Bites shall assess refund requests based on available information, which may
include:
● Customer reports and evidence
● Store response and cooperation
● Historical performance and complaint patterns
● Platform data, including order and pickup records
All decisions shall be made in a commercially reasonable manner and in good faith.
11.3 The Store acknowledges and agrees that:
● Any refund issued to a Customer shall be deducted from amounts payable to the Store
● Best By Bites may also deduct associated costs, including payment processing fees and
chargeback costs
● Where insufficient funds are available, Best By Bites may offset such amounts against
future payouts
11.4 In the event of a payment dispute or chargeback initiated by a Customer:
● The Store shall cooperate fully and promptly provide any requested information
● Best By Bites may represent the transaction or accept the chargeback at its discretion
● All resulting losses, fees, and administrative costs may be passed on to the Store
11.5 Best By Bites reserves the right to apply additional financial adjustments or operational
measures where the Store demonstrates a pattern of:
● Order non-fulfillment
● Repeated customer complaints
● Poor quality or unsafe food practices
Such measures may include increased monitoring, temporary withholding of payouts, or
application of penalties in accordance with these Terms.
11.6 Best By Bites shall not be liable for refund decisions made in accordance with this Section,
provided such decisions are made reasonably and in good faith.
12. DATA PROTECTION & PRIVACY
12.1 Best By Bites processes personal information in accordance with the Personal Information
Protection and Electronic Documents Act.
12.2 The Store shall use any personal information received solely for:
● Fulfilling Rescue Pack orders
● Providing customer support
12.3 The Store shall implement reasonable safeguards, including:
● Access controls
● Secure storage
● Protection against unauthorized disclosure
12.4 The Store shall not:
● Use data for independent marketing
● Sell or transfer data
● Retain data beyond necessity
12.5 The Store shall promptly notify Best By Bites of any data breach or suspected breach and
cooperate in mitigation.
12.6 Best By Bites may engage third-party processors subject to contractual safeguards.
12.7 Individuals have rights to access and correct their personal information in accordance with
applicable law.
13. PERFORMANCE MONITORING & PLATFORM
CONTROLS
13.1 Best By Bites may monitor Store performance based on:
● Customer ratings and reviews
● Order completion rates
● Complaint frequency
● Cancellation behavior
13.2 Based on performance, Best By Bites may:
● Adjust listing visibility
● Limit or suspend Listings
● Apply operational restrictions
● Terminate the Store account
13.3 These actions shall be taken in a commercially reasonable manner to maintain Platform
quality.
14. CONFIDENTIALITY
14.1 Each party agrees to keep confidential all non-public information received from the other
party.
14.2 Confidential Information may only be used for purposes of fulfilling obligations under these
Terms.

-- 6 of 11 --

14.3 Disclosure is permitted where required by law or to professional advisors bound by
confidentiality.
14.4 These obligations survive termination for a period of three (3) years.
15. INTELLECTUAL PROPERTY
15.1 The Store grants Best By Bites a non-exclusive, royalty-free license to use its name, logo,
and branding for Platform operations and marketing.
15.2 The Store retains ownership of its intellectual property.
15.3 Best By Bites retains all rights in the Platform, including software, content, and branding.
16. LIMITATION OF LIABILITY
16.1 To the fullest extent permitted by law, Best By Bites shall not be liable for:
● Indirect or consequential damages
● Loss of profits or revenue
● Business interruption
16.2 Total liability shall not exceed amounts paid to the Store in the preceding three (3) months.
16.3 Nothing excludes liability that cannot be excluded under law.
16.4 These limitations survive termination.
17. INDEMNIFICATION
17.1 The Store shall indemnify, defend, and hold harmless Best By Bites from all claims,
damages, losses, and expenses (including legal fees) arising from:
● Food safety issues
● Legal violations
● Breach of these Terms
17.2 This obligation survives termination.
18. SUSPENSION & TERMINATION
18.1 Best By Bites may suspend or terminate the Store account where:

-- 7 of 11 --

● Terms are breached
● Fraud or misuse is suspected
● Safety risks arise
● Legal compliance issues occur
18.2 Where feasible, notice and opportunity to cure will be provided.
18.3 Immediate termination may occur in high-risk situations.
18.4 Actions shall be exercised reasonably and in good faith.
19. DISCLAIMER
19.1 The Platform, including all features, functionality, and services, is provided on an “as is”
and “as available” basis without any representations, warranties, or guarantees of any kind,
whether express, implied, or statutory.
19.2 To the fullest extent permitted by applicable law, Best By Bites expressly disclaims all
warranties, including but not limited to:
● Merchantability
● Fitness for a particular purpose
● Non-infringement
● Accuracy, reliability, or completeness of the Platform
19.3 Best By Bites does not warrant that:
● The Platform will be uninterrupted, secure, or error-free
● Any defects will be corrected
● The Platform will meet the Store’s business expectations or generate revenue
19.4 The Store acknowledges that:
● Use of the Platform is at its own risk
● Business outcomes depend on multiple factors beyond the control of Best By Bites
20. CHANGES TO TERMS
20.1 Best By Bites reserves the right to modify, update, or replace these Terms from time to
time.
20.2 Where changes are material, Best By Bites shall provide at least fourteen (14) days’ prior
notice, unless immediate changes are required for legal, regulatory, or security reasons.

-- 8 of 11 --

20.3 Notice may be provided via:
● Email
● Platform notification
● Dashboard alerts
20.4 Continued use of the Platform after the effective date of updated Terms constitutes
acceptance of such changes.
20.5 If the Store does not agree to the updated Terms, it must cease using the Platform.
21. GOVERNING LAW
21.1 These Terms shall be governed by and construed in accordance with the laws of the
Province of Ontario and the federal laws of Canada applicable therein.
21.2 Subject to Section 22, the parties agree to submit to the exclusive jurisdiction of the courts
located in Ontario, Canada.
22. DISPUTE RESOLUTION
22.1 The parties shall first attempt to resolve any dispute arising out of or in connection with
these Terms through good faith negotiations.
22.2 If a dispute cannot be resolved within thirty (30) days, either party may initiate formal
proceedings.
22.3 Disputes may be resolved through:
● Courts of competent jurisdiction in Ontario
● Alternative dispute resolution mechanisms where mutually agreed
22.4 Nothing in this section shall prevent either party from:
● Seeking injunctive or equitable relief
● Bringing a claim where arbitration or limitation provisions are not enforceable under
applicable law
22.5 Each party shall bear its own legal costs unless otherwise determined by a court.
23. CONTACT
23.1 For any questions, notices, or legal communications relating to these Terms, you may
contact:

-- 9 of 11 --

Best By Bites
Email: support@bestbybites.com
23.2 Best By Bites may also contact the Store using the contact details provided in the Store
account.
24. COMPLIANCE WITH ELECTRONIC COMMUNICATION
LAWS
24.1 The Store agrees to comply with all applicable laws governing electronic communications,
including Canada's Anti-Spam Legislation.
24.2 The Store shall not send commercial electronic messages (including email or SMS) to
Customers obtained through the Platform unless:
● The recipient has provided valid consent
● The message clearly identifies the sender
● A functional and easy-to-use unsubscribe mechanism is included
24.3 The Store shall maintain records of consent where required under applicable law.
24.4 Any violation of this section may result in immediate suspension or termination of the Store
account.
25. COMMUNICATION RESTRICTIONS & DATA USE
LIMITATIONS
25.1 The Store shall not use Customer data obtained through the Platform for:
● Off-platform marketing
● Direct solicitation
● Sale or sharing with third parties
25.2 The Store shall only use Customer information strictly for:
● Order fulfillment
● Customer service related to Platform transactions.
25.3 Any unauthorized use of Customer data shall constitute a material breach of these Terms.
25.4 Best By Bites reserves the right to:
● Suspend or terminate the Store account
● Withhold payouts

-- 10 of 11 --

● Take legal action
in the event of misuse of Customer data.
25.5 These obligations shall survive termination of the agreement.

-- 11 of 11 --
`,

  scheduleA: `SCHEDULE A – COMMERCIAL TERMS
(FINAL CLEAN VERSION)
(Forms an integral part of the Best By Bites Store Terms & Conditions)
A1. PLATFORM FEES
A1.1 Commission Structure
In consideration for access to and use of the Platform, the Store agrees to pay Best By Bites:
● A commission fee equal to 20% of the total selling price of each Surprise Bag; and
● Any applicable payment processing fees, service charges, or additional platform
fees.
A1.2 Fee Application
● The commission shall be calculated on the gross transaction value (including any
applicable taxes unless otherwise specified).
● All fees shall be automatically deducted prior to payout.
A1.3 Fee Adjustments
Best By Bites may:
● Offer promotional discounts or reduced commission rates temporarily;
● Modify fees upon reasonable notice;
● Introduce new service-related fees where necessary for platform operations.
A2. PAYMENT COLLECTION & AUTHORIZATION
A2.1 Appointment
The Store appoints Best By Bites as a limited payment collection agent solely for collecting
payments from Customers.
A2.2 Authorization

-- 1 of 6 --

The Store authorizes Best By Bites to:
● Collect and process payments
● Deduct fees, refunds, penalties, and adjustments
● Temporarily hold funds for operational purposes
A2.3 Payment Settlement
Payment by a Customer to Best By Bites:
● Constitutes full and final settlement of the Customer’s obligation to the Store
A2.4 No Financial Services
Best By Bites does not provide:
● Banking services
● Escrow services
● Trust or fiduciary services
A2.5 Fund Handling
Funds may be:
● Temporarily held
● Commingled with other funds
● Processed via third-party payment providers
A3. PAYOUT TERMS
A3.1 Payout Schedule
Best By Bites shall remit net payouts:
● On a periodic basis (e.g., weekly or bi-weekly)
● To the Store’s designated bank account
A3.2 Net Payout Calculation
Net Payout = Customer Payments – (Commission + Fees + Refunds + Chargebacks +
Penalties + Adjustments)

-- 2 of 6 --

A3.3 Payout Controls
Payouts may be:
● Delayed
● Adjusted
● Withheld
where reasonably necessary for:
● Fraud investigation
● Disputes or chargebacks
● Legal or regulatory compliance
● Technical or operational issues
A3.4 Liability Disclaimer
Best By Bites shall not be liable for:
● Delays caused by payment processors
● Incorrect banking details provided by the Store
A4. REFUNDS, CHARGEBACKS & ADJUSTMENTS
A4.1 Refund Authority
Best By Bites may issue refunds in accordance with Section 11.
A4.2 Financial Responsibility
The Store agrees that:
● Refunds shall be deducted from payouts
● Chargebacks and related costs shall be borne by the Store
● Payment processor penalties may be passed to the Store
A4.3 Recovery Rights
If insufficient funds exist:
● Best By Bites may recover amounts from future payouts

-- 3 of 6 --

● Best By Bites may invoice the Store for outstanding balances
A4.4 Administrative Fees
Best By Bites may apply additional fees for:
● Excessive disputes
● Fraudulent activity
● Operational inefficiencies
A5. PENALTIES & PERFORMANCE ADJUSTMENTS
A5.1 Grounds for Penalties
Penalties may apply where the Store:
● Cancels orders within restricted timeframes
● Fails to fulfill confirmed Surprise Bags
● Provides unsafe or poor-quality food
● Receives repeated substantiated complaints
A5.2 Types of Penalties
Penalties may include:
● Fixed deductions
● Percentage-based deductions
● Reduction in payouts
● Temporary withholding of earnings
A5.3 Operational Actions
Best By Bites may also:
● Reduce visibility
● Restrict listings
● Suspend accounts
A5.4 Fair Application
All penalties shall be applied in a commercially reasonable and proportionate manner.
A6. TAXES
A6.1 Store Responsibility
The Store is solely responsible for:
● Determining applicable taxes (GST/HST)
● Collecting and remitting taxes
● Filing all required returns
A6.2 Platform Role
Best By Bites may:
● Provide transaction summaries
● Report information where legally required
A6.3 Indemnity
The Store shall indemnify Best By Bites for tax liabilities arising from:
● Incorrect tax information
● Non-compliance
A7. SET-OFF RIGHTS
A7.1 Right of Set-Off
Best By Bites may deduct any amounts owed by the Store from payouts, including:
● Refunds
● Chargebacks
● Fees
● Penalties
● Damages
A7.2 Enforcement
This right applies:

-- 5 of 6 --

● Automatically
● Without prior notice (where reasonably necessary)
A7.3 Survival
This right survives termination.

-- 6 of 6 --
`,
};

const LegalPolicies = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { vendorProfile, merchantCurrencyCode } = useAuth();

  const [geoCountryCode, setGeoCountryCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    const lat = vendorProfile?.latitude;
    const lng = vendorProfile?.longitude;
    if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
      setGeoCountryCode('');
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const cc = (await fetchCountryCodeFromLatLng(lat, lng)) || '';
      if (cancelled) return;
      setGeoCountryCode(cc);
    })();

    return () => {
      cancelled = true;
    };
  }, [vendorProfile?.latitude, vendorProfile?.longitude]);

  const bucket = useMemo(
    () => merchantCountryBucket(vendorProfile, merchantCurrencyCode, geoCountryCode),
    [vendorProfile, merchantCurrencyCode, geoCountryCode]
  );

  const tabs = bucket === 'canada' ? CANADA_TABS : INDIA_TABS;
  const tabIds = useMemo(() => new Set(tabs.map((t) => t.id)), [tabs]);
  const policies = bucket === 'canada' ? CANADA_POLICIES : INDIA_POLICIES;

  const activeId = useMemo(() => {
    const raw = searchParams.get('tab');
    return raw && tabIds.has(raw) ? raw : tabs[0].id;
  }, [searchParams, tabIds, tabs]);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const content = policies[active.id] || '';

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
          {tabs.map((tab) => {
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
