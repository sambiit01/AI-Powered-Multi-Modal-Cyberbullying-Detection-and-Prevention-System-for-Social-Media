# ShieldAI: AI-Powered Multi-Modal Cyberbullying Detection System

ShieldAI is a sophisticated web application built with Next.js and Firebase that leverages cutting-edge Generative AI to detect and prevent cyberbullying across multiple modalities, including text, images, and user behavior patterns.

## ✨ Key Features

- **Multi-Modal Detection:** Analyzes text, image captions, and user communication patterns to identify instances of cyberbullying.
- **Behavioral Inference Engine:** Automatically tracks relationship levels (Stranger to Close Friend) and detects "Bursting" (harassment patterns).
- **Admin Review Console:** Centralized dashboard for superusers to audit activities and provide manual corrections to refine the AI.
- **AI Suppression Logic:** Global sensitivity thresholds that prevent low-confidence flags from affecting users.
- **Secure Authentication:** Role-based access control (RBAC) via Firebase Auth and Firestore.

## 🚀 Pushing to GitHub

Follow these steps to upload your project to a new GitHub repository:

1. **Initialize Git:**
   ```bash
   git init
   ```

2. **Add Files:**
   ```bash
   git add .
   ```

3. **Commit Changes:**
   ```bash
   git commit -m "Initial commit: Complete ShieldAI implementation"
   ```

4. **Create a Repo on GitHub:**
   Go to [github.com/new](https://github.com/new) and create a repository named `shieldai`.

5. **Link and Push:**
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/shieldai.git
   git push -u origin main
   ```

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router)
- **AI Core:** Genkit + Google Gemini 2.0/3.0 Flash
- **Backend:** Firebase (Auth, Firestore)
- **UI:** ShadCN UI + Tailwind CSS

## 🤝 Contributors

- **Sambit Bhoumik** (Admin/Backend)
- **Aditya Paul** (UI/UX)
- **Agnik Ghosh** (Database)
- **Arunava Saha** (AI Flows)

---
*Developed as part of the ShieldAI Cyberbullying Prevention Project.*