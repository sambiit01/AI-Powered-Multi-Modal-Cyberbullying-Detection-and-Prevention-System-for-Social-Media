
# ShieldAI: An AI-Powered Multi-Modal System for Cyberbullying Detection and Prevention

---

### **A Project Report**

**Authors:**

*   **Sambit Bhoumik** (Team Lead, Backend & AI Integration)
*   **Aditya Paul** (Frontend & UI/UX Development)
*   **Agnik Ghosh** (Database & System Architecture)
*   **Arunava Saha** (AI/ML Flow Development & Data Analysis)

---

## Abstract

Cyberbullying has become a pervasive and damaging issue across social media platforms, inflicting significant psychological and emotional harm on individuals. Traditional content moderation systems, which often rely on reactive user reports and simplistic keyword filtering, are ill-equipped to handle the complex, nuanced, and multi-modal nature of online harassment. This project, **ShieldAI**, presents a sophisticated, real-time web application designed to proactively detect and mitigate cyberbullying. By leveraging cutting-edge Generative AI, the system performs a multi-modal analysis of content—encompassing text, images, and user communication patterns—to identify potential aggressors and victims. ShieldAI provides administrators with a powerful dashboard for real-time monitoring, detailed user analysis, and robust reporting tools. Developed with a modern technology stack including Next.js, Firebase, and Google's Gemini models, ShieldAI offers an intelligent, scalable, and proactive solution aimed at fostering safer and more positive online communities.

---

## 1. Introduction

### 1.1. The Problem of Cyberbullying

The rapid expansion of social media has revolutionized global communication, but it has also given rise to new and insidious forms of aggression. Cyberbullying—the use of digital communication to bully a person, typically by sending messages of an intimidating or threatening nature—is one of the most widespread and harmful byproducts of our interconnected world. The perceived anonymity and psychological distance of online interactions can embolden malicious behavior, making it exceedingly difficult for platforms to moderate content effectively and protect their users.

Existing solutions are predominantly reactive. They rely heavily on users to report offensive content, a process that is often slow and places an undue burden on the victims. Furthermore, automated systems based on keyword filtering are easily circumvented through the use of slang, coded language, or implicit threats. They completely fail to capture bullying that occurs through visual mediums, such as humiliating images or text embedded within memes.

### 1.2. Our Solution: ShieldAI

ShieldAI was conceived and developed to address the critical limitations of current moderation systems. It is an intelligent, multi-modal detection and prevention system that moves beyond rudimentary text analysis. By integrating user behavior profiling, image content analysis, and advanced text semantics, ShieldAI can identify subtle and overt patterns of abuse in real-time.

The core objective of this project is to create a system that:
*   **Analyzes content across multiple modalities**, including text and images.
*   **Profiles user behavior** to identify patterns indicative of bullying or victimization.
*   **Provides a real-time dashboard** for administrators to monitor platform health and intervene when necessary.
*   **Empowers users** with intuitive tools to report harmful content manually.

By flagging harmful content and high-risk users before situations escalate, ShieldAI empowers platform administrators to take proactive measures, thereby creating a safer and more supportive environment for all users.

---

## 2. System Architecture and Design

The architecture of ShieldAI was designed for scalability, real-time responsiveness, and security. The system is logically divided into three primary layers: the frontend, the backend, and the AI core.

### 2.1. Overall System Architecture

| Layer | Technology | Role & Responsibility | Contributor(s) |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js, React, Tailwind CSS, ShadCN UI | Provides a responsive, interactive, and modern user interface for administrators. Manages client-side state and user interactions. | Aditya Paul |
| **Backend** | Firebase (Authentication, Firestore) | Handles secure user authentication, role-based access control, and persistent data storage in a NoSQL database. | Agnik Ghosh |
| **AI Core** | Genkit, Google Gemini Models | Powers the multi-modal analysis, including text detection, image analysis, and behavioral pattern recognition. | Sambit Bhoumik, Arunava Saha |


*(Note: A conceptual diagram would be inserted here in a final document.)*

### 2.2. Frontend Design (Aditya Paul)

The user interface was built using **Next.js 14** with the App Router, ensuring a fast, server-rendered experience with efficient client-side navigation.
*   **Component Library:** We utilized **ShadCN UI**, a collection of accessible and composable React components, which allowed for rapid development of a professional-looking dashboard.
*   **Styling:** **Tailwind CSS** was used for all styling, enabling a utility-first approach that kept the design system consistent and maintainable.
*   **State Management:** Client-side state, such as the active view and form inputs, was managed using React's built-in hooks (`useState`, `useEffect`) and the `useAuth` custom hook for session management.
*   **Responsiveness:** All components were designed to be fully responsive, ensuring a seamless experience on devices ranging from large desktops to mobile phones.

### 2.3. Backend and Database (Agnik Ghosh)

The backend infrastructure is powered entirely by **Firebase**, providing a robust and scalable "Backend-as-a-Service" (BaaS) solution.
*   **Firebase Authentication:** Manages all user-related functionalities, including email/password sign-up and sign-in. It was also used to implement a role-based access control (RBAC) system, distinguishing between a "superuser" and regular "user" roles.
*   **Firestore:** A flexible, scalable NoSQL database used to store all application data. This includes:
    *   `users` collection: Stores user profiles and their assigned roles.
    *   `activities` collection: A comprehensive log of all detected incidents, manual reports, and user analysis results.
    *   The real-time nature of Firestore ensures that the dashboard's activity feed and metrics are always up-to-date without requiring manual refreshes. Database security rules were configured to ensure that users can only access their own data.

### 2.4. AI Core Integration (Sambit Bhoumik & Arunava Saha)

The intelligence of ShieldAI is driven by **Google's Gemini family of models**, orchestrated using the **Genkit** framework. This allowed for the creation of structured, testable, and server-side AI flows.
*   **Genkit Flows:** We developed several distinct AI flows, each responsible for a specific analytical task. These flows are defined as server-side functions that can be called from the Next.js frontend.
    *   `detectCyberbullyingFromText`: Analyzes raw text for signs of bullying.
    *   `extractTextFromMedia`: Uses multi-modal capabilities to extract text from images.
    *   `analyzeUserCommunicationPatterns`: Profiles a user's message history to generate risk scores.
*   **Multi-Modal Analysis:** The system's key innovation is its ability to process more than just text. For images, the `extractTextFromMedia` flow first extracts any text present in the image. This text is then passed to the `detectCyberbullyingFromText` flow for analysis, allowing the system to catch cyberbullying in memes or screenshots.
*   **Model Selection:** The `gemini-2.5-flash` model was chosen for its optimal balance of speed, accuracy, and cost, making it suitable for real-time analysis tasks.

---

## 3. Key Features and Implementation

### 3.1. Multi-Modal Content Moderation (Arunava Saha)

This feature allows administrators to analyze content for cyberbullying in real-time.
*   **Text Analysis:** The system takes a block of text, sends it to the `detectCyberbullyingFromText` flow, and receives a structured JSON response containing:
    *   `isCyberbullying` (boolean): A clear determination.
    *   `reason` (string): An AI-generated explanation for the classification.
    *   `confidenceScore` (number): The model's confidence in its assessment.
*   **Image/Media Analysis:** When a user uploads an image, the frontend first converts it to a Base64-encoded data URI. This URI is sent to the `extractTextFromMedia` flow. If text is successfully extracted, it is then fed into the text analysis flow. This two-step process effectively moderates visual content that contains harmful text.

### 3.2. User Behavior Analysis (Sambit Bhoumik)

This feature provides a deeper, more contextual form of analysis by looking at a user's communication history.
*   **Input:** An administrator can input a user's ID and a list of their recent messages (e.g., copied from a chat log).
*   **AI Flow:** The data is processed by the `analyzeUserCommunicationPatterns` flow. This flow is prompted to analyze the messages for patterns of aggression, victimization, and overall sentiment.
*   **Output:** The system returns a detailed report, including:
    *   **Bullying Likelihood:** A score from 0 to 1 indicating the probability that the user is an aggressor.
    *   **Victim Likelihood:** A score from 0 to 1 indicating the probability that the user is a victim.
    *   **Detailed Analysis:** A qualitative summary of the user's behavior, highlighting specific examples.
    This feature is crucial for identifying chronic bullies or at-risk victims who may require intervention.

### 3.3. Real-Time Dashboard & Analytics (Aditya Paul)

The dashboard serves as the central command center for administrators.
*   **Key Metrics:** At-a-glance cards display critical statistics: Total Incidents Flagged, High-Risk Users, Potential Victims, and Manual Reports Submitted.
*   **Incident Trends:** A bar chart visualizes the number of detected incidents over the past six months, helping administrators identify trends.
*   **Recent Activity Feed:** A real-time table, powered by a direct subscription to the Firestore `activities` collection, shows the latest automated detections and manual reports as they occur.

### 3.4. Manual Reporting Tool (Agnik Ghosh)

To ensure a human-in-the-loop process, ShieldAI includes a manual reporting tool.
*   **Functionality:** Users and administrators can submit a URL of offending content, categorize the type of bullying (e.g., Harassment, Hate Speech), and provide a detailed description.
*   **Integration:** Upon submission, a new entry is created in the Firestore `activities` collection with the type "Report" and status "Pending". This immediately appears in the real-time activity feed on the dashboard for review.

---

## 4. Conclusion and Future Scope

ShieldAI successfully demonstrates the immense potential of multi-modal Generative AI in creating a more intelligent, effective, and nuanced cyberbullying detection system. By moving beyond simplistic keyword matching and incorporating behavioral and visual analysis, it provides a holistic approach to promoting online safety. The robust and scalable architecture, built on Next.js and Firebase, ensures that the system is real-time, secure, and ready for production environments.

### 4.1. Future Enhancements

The current implementation provides a strong foundation. Future work could expand upon its capabilities in several key areas:
*   **Video Content Analysis:** Extend the AI flows to process video content, analyzing both spoken words (speech-to-text) and visual gestures for harmful behavior.
*   **Automated Moderation Actions:** Implement configurable rules to trigger automated actions, such as temporary account suspension or content removal, when an incident exceeds a certain severity threshold.
*   **Victim Support Chatbot:** Develop an AI-powered chatbot that can offer immediate, confidential support and mental health resources to users identified as potential victims.
*   **Advanced Analytics:** Enhance the dashboard with more granular analytics, including breakdowns of bullying types, platform "hotspots," and metrics on the effectiveness of moderation interventions over time.
*   **Cross-Platform Integration:** Develop a secure API that would allow third-party social media platforms, forums, or online gaming communities to integrate with the ShieldAI detection engine as a service.
