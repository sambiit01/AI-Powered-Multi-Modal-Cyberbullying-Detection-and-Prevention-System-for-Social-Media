# ShieldAI: AI-Powered Multi-Modal Cyberbullying Detection System

ShieldAI is a sophisticated web application built with Next.js and Firebase that leverages cutting-edge Generative AI to detect and prevent cyberbullying across multiple modalities, including text, images, and user behavior patterns.



 

## ✨ Key Features

- **Multi-Modal Detection:** Analyzes text, image captions, and user communication patterns to identify instances of cyberbullying.
- **Real-Time Analysis:** Provides instant feedback and flags potentially harmful content as it's submitted.
- **User Behavior Profiling:** Identifies potential bullies and victims by analyzing communication history and patterns.
- **Manual Reporting System:** Allows users to manually report incidents of cyberbullying for review.
- **Secure Authentication:** Complete user management system with Firebase Authentication, including role-based access for "superusers" and "users".
- **Persistent Data:** All user activity and analysis results are securely stored in Firestore, ensuring data is never lost.
- **Responsive Dashboard:** A clean, modern, and responsive user interface built with ShadCN UI and Tailwind CSS.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (with App Router)
- **Generative AI:** [Google's Gemini models via Genkit](https://firebase.google.com/docs/genkit)
- **Backend & Database:** [Firebase](https://firebase.google.com/) (Authentication, Firestore)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [ShadCN UI](https://ui.shadcn.com/)
- **Deployment:** [Firebase App Hosting](https://firebase.google.com/docs/app-hosting)

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js (v18 or higher)
- A Firebase project

### Installation

1.  Clone the repo:
    ```sh
    git clone https://github.com/Paul-Aditya3/AI-Powered-Multi-Modal-Cyberbullying-Detection-and-Prevention-System-for-Social-Media.git
    ```
2.  Install NPM packages:
    ```sh
    npm install
    ```
3.  Set up your environment variables. Create a `.env.local` file in the root of your project and add your Firebase project credentials. You can get these from your Firebase project settings.
    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    ```
4.  Run the development server:
    ```sh
    npm run dev
    ```

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

This project was developed with the assistance of **sambiit01**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
