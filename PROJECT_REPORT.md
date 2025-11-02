
# Project Report: ShieldAI - An AI-Powered Multi-Modal Cyberbullying Detection System

**Author:** sambiit01  
**Contributors:** Paul-Aditya3  
**Live Application:** [https://shieldai-ab7ge.web.app](https://shieldai-ab7ge.web.app)

---

## 1. Abstract

Cyberbullying is a significant and growing problem on social media platforms, causing severe psychological and emotional harm. Traditional moderation systems often fail to capture the nuanced and multi-modal nature of online harassment. This project, **ShieldAI**, presents a sophisticated web application designed to detect and prevent cyberbullying by leveraging cutting-edge Generative AI. The system analyzes content across multiple modalities—including text, images, and user communication patterns—to provide real-time analysis, identify potential bullies and victims, and offer robust reporting tools. Built with a modern tech stack including Next.js, Firebase, and Google's Gemini models via Genkit, ShieldAI offers a proactive and intelligent solution to creating safer online environments.

---

## 2. Introduction

The proliferation of social media has connected the world, but it has also given rise to new forms of aggression, with cyberbullying being one of the most pervasive. The anonymity and distance of online interactions can embolden malicious behavior, making it difficult for platforms to effectively moderate. Current solutions are often reactive, relying heavily on user reports and keyword filtering, which can be slow and ineffective against implicit or visual forms of bullying.

ShieldAI was developed to address these limitations. It is an intelligent, multi-modal system that moves beyond simple text analysis. By integrating user behavior profiling and image content analysis, ShieldAI can identify subtle patterns of abuse and flag harmful content before it escalates, empowering administrators and protecting users.

---

## 3. System Architecture

ShieldAI is built on a robust, scalable, and modern architecture designed for real-time interaction and analysis.

-   **Frontend:** A responsive and interactive user interface built with **Next.js** and the App Router. Components are crafted using **ShadCN UI** and styled with **Tailwind CSS**, ensuring a clean and modern user experience on any device.

-   **Backend & Database:** **Firebase** serves as the comprehensive backend solution.
    -   **Firebase Authentication** manages user sign-up, login, and secure session handling. It also supports role-based access control (e.g., "superuser" vs. "user").
    -   **Firestore** is used as the NoSQL database to persistently store all application data, including user profiles, activity logs, analysis results, and manual reports. Its real-time capabilities ensure the dashboard is always up-to-date.

-   **Generative AI Core:** The intelligence of ShieldAI is powered by **Google's Gemini family of models**, accessed through the **Genkit** framework.
    -   **Multi-Modal Analysis:** Genkit flows are designed to process different types of data. The `gemini-2.5-flash` model is used for complex reasoning tasks, including text analysis, caption analysis, and behavioral pattern recognition.
    -   **Image-to-Text:** The AI can extract and understand text embedded within images, allowing for a deeper level of content moderation.

-   **Deployment:** The application is configured for seamless deployment on **Firebase App Hosting**, providing a scalable, secure, and globally distributed hosting environment. It is also compatible with other platforms like Vercel.

---

## 4. Key Features

ShieldAI is equipped with a suite of powerful features designed for comprehensive cyberbullying detection and prevention.

-   **Multi-Modal Content Moderation:**
    -   **Text Analysis:** Scans text-based content (comments, messages) in real-time to detect insults, threats, hate speech, and harassment.
    -   **Image Analysis:** Extracts text from images and analyzes image captions to identify visual or context-based bullying that text-only systems would miss.

-   **User Behavior Analysis:**
    -   Analyzes a user's communication history to generate a "Bullying Likelihood" and "Victim Likelihood" score.
    -   This helps identify high-risk users who may be habitual bullies and potential victims who may need support, allowing for proactive intervention.

-   **Real-Time Dashboard:**
    -   Provides an at-a-glance overview of key metrics, including total incidents flagged, high-risk users identified, and manual reports submitted.
    -   Features a live activity feed and charts to visualize incident trends over time.

-   **Manual Reporting Tool:**
    -   Empowers users to manually report instances of cyberbullying by submitting a URL and a description of the incident.
    -   These reports are logged for review by administrators, ensuring a human-in-the-loop moderation process.

-   **Secure User and Role Management:**
    -   Complete user authentication system powered by Firebase.
    -   Includes a "superuser" role with elevated privileges, demonstrating a foundation for role-based access control.

-   **Persistent and Real-Time Data:**
    -   All activities, user data, and analysis results are securely stored in Firestore and updated in real-time on the dashboard.

---

## 5. Technology Stack

-   **Framework:** Next.js (with App Router)
-   **Generative AI:** Google's Gemini models via Genkit
-   **Backend Services:** Firebase (Authentication, Firestore)
-   **UI Components:** ShadCN UI
-   **Styling:** Tailwind CSS
-   **Icons:** Lucide React
-   **Form Management:** React Hook Form & Zod
-   **Deployment:** Firebase App Hosting, Vercel

---

## 6. Conclusion and Future Scope

ShieldAI successfully demonstrates the power of multi-modal Generative AI in creating a more effective and nuanced cyberbullying detection system. By moving beyond simple keyword matching and incorporating behavioral and visual analysis, it provides a more holistic approach to online safety. The robust architecture built on Next.js and Firebase ensures the system is scalable, real-time, and secure.

### Future Enhancements:

-   **Video Content Analysis:** Extend the AI flows to analyze video content for harmful speech, gestures, or scenes.
-   **Automated Actions:** Implement automated moderation actions, such as temporary account suspension or content removal, based on configurable severity thresholds.
-   **Victim Support Chatbot:** Develop an AI-powered chatbot to offer immediate support and resources to users identified as potential victims.
-   **Advanced Analytics:** Enhance the dashboard with more detailed analytics on bullying types, platform hotspots, and the effectiveness of interventions.
-   **Cross-Platform Integration:** Develop APIs to allow other social media platforms or online communities to integrate with the ShieldAI detection engine.
