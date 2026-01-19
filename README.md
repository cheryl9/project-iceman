## **Granted**

This document provides details about the frontend and backend implementation for our Granted project.

- [Granted Frontend](#granted-frontend)
- [Granted Backend](#granted-backend)

## **Project Overview:**

**Granted** is an AI-powered grant discovery platform designed to help nonprofits efficiently identify, evaluate, and track relevant funding opportunities. By combining AI-driven match scoring with an intuitive swipe-based interface, Granted simplifies the grant search process, reduces cognitive load, and increases funding success rates. It is built using [**React.js**](http://NReact.js)**, Next.js**, **Firebase**, **Playwright, BeautifulSoup** and **Python**, leveraging on data processing pipelines for grant information, and a responsive front-end interface for interactive exploration. 

Github Link: [https://github.com/cheryl9/project-iceman.git](https://github.com/cheryl9/project-iceman.git)

## **Product Prototype**

Link: [https://project-iceman-wheat.vercel.app/](https://project-iceman-wheat.vercel.app/)

## **Technological Stack**

**Framework & Development:**

* [Next.js](https://nextjs.org) – React-based framework for server-side rendering and routing  
* Bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app)

**Frontend & UI:**

* React.js – Component-based UI development  
* Tailwind CSS – Responsive styling  
* [next/font](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) – Automatic font optimization (using Geist font)  
* Figma – Prototyping and UI design

**Backend & Database:**

* Firebase – Realtime database and user authentication  
* Playwright  
* Beautiful Soup

**AI & Machine Learning:**

* Python – Core AI backend

**Deployment & Optimization:**

* Vercel – Hosting Next.js frontend  
* Flask \+ Firebase backend integration

**Other Tools:**

* VSCode – Development environment  
* Git & GitHub – Version control

## **Team Contributions**

1. Nathan Tay Jia He (Data Lead):  
Nathan handled the data processing pipeline, collecting, cleaning, and structuring grant data from OurSG Grants portal. He ensured that the information fed into the AI model was accurate, complete, and consistently formatted. His work enables the platform to provide reliable recommendations, and it forms the backbone of the AI system’s ability to evaluate and rank grant opportunities effectively.  
2. Seow Shi Hui, Cheryl (Solutions Architect):  
Cheryl designed and implemented the AI-powered match scoring system that recommends the most relevant grants to nonprofits based on their profile and swipe interactions. She also integrated the backend with Firebase, managing data storage, user authentication, and real-time updates, ensuring a seamless and reliable connection between the AI engine and the frontend interface. Her work ensures that the platform delivers accurate, personalised grant recommendations efficiently.  
3. Yi Yang (Visual Designer):  
Yiyang designed and implemented the intuitive user interface, focusing on the card-based swipe interactions and advanced filtering system. He created a clean, responsive, and mobile-friendly layout that allows nonprofits to browse, swipe, and save grants effortlessly. He also collaborated closely with the backend and AI teams to ensure smooth integration, so that the interface reflects real-time match scores and personalized recommendations accurately. His work ensures that users can discover relevant opportunities quickly while enjoying a seamless and engaging experience.

## 

## **Granted Frontend**

Granted is a web application designed to simplify grant discovery for nonprofits. It features an interactive swipe-based interface, allowing users to quickly indicate interest or disinterest in grants. Users can save promising opportunities to a centralized dashboard for easy tracking, while advanced filters let them sort grants by sector, funding amount, KPIs, and deadlines. By combining intuitive interactions with AI-powered match scoring, Granted makes discovering, evaluating, and organising grants fast, engaging, and highly personalised

## **Features**

* **Swipe-based discovery interface:** Quickly indicate interest or disinterest in grants using intuitive card interactions

* **AI match scoring:** View relevance scores for each grant, tailored to your organization’s profile and preferences

* **Browse & save grants:** Explore all available grants and save promising ones to a centralised dashboard

* **Real-time updates:** Match scores and saved grant data update seamlessly via Firebase integration

* **Advanced filtering:** Sort grants by sector, funding amount, KPIs, or deadlines for targeted exploration

* **Interactive dashboard:** Track saved grants, upcoming deadlines, and application progress at a glance

* **Mobile-friendly & responsive:** Optimized for desktop and mobile use, enabling on-the-go grant discovery

* **Gamified engagement:** Swipe interactions make grant browsing fast, easy, and enjoyable

* **Clean, professional UI:** Inspired by familiar card-based apps to reduce cognitive load while maintaining a polished, nonprofit-focused experience

## **Technologies & Tools Used**

* [React.js](http://React.js), [Next.js](http://Next.js)  
* Tailwind CSS  
* Figma

## **Design Process**

Inspired by dating platforms that prioritize intuitive decision-making and user-centered design, Granted’s UI focuses on clarity, context, and seamless interactions. The swipe-based card interface allows users to quickly indicate interest or disinterest in grants, while advanced filters help narrow down opportunities by sector, funding amount, KPIs, and deadlines. Saved grants are organised in a centralised dashboard, giving users a clear overview of opportunities and upcoming deadlines. Visual gradients, responsive cards, and dynamic charts guide nonprofits in making informed funding decisions efficiently, and the interface incorporates TikTok-inspired colours to create a modern, engaging, and familiar user experience.

## **ReviewGuard AI Backend**

The Granted backend is designed to provide nonprofits with fast, reliable, and intelligent access to grant opportunities. It leverages **Firebase Firestore** for real-time data storage and retrieval, **Python scripts and AI pipelines** for personalized grant recommendations, and advanced filtering logic to enable dynamic exploration of opportunities.

## **How it works:**

1. **Data Ingestion & Processing**  
   Grants data from OurSG and other sources is ingested via JSON/JSONL files and structured into Firestore documents. Each grant is cleaned, normalized, and organized with metadata such as issue areas, scope tags, funding caps, application deadlines, and agency information, ensuring consistent and queryable data for AI scoring and user interactions.

2. **AI-Powered Match Scoring**  
   AI models evaluate each grant’s relevance to a nonprofit’s profile, generating a match score that informs the swipe-based interface. By combining profile data and historical selections, the system personalizes recommendations in real-time.

3. **Advanced Filtering & Search**  
   Users can filter grants by issue areas, scope tags, agencies, and funding ranges. Complex filtering is performed client-side using Python logic, ensuring flexible queries without compromising performance.

4. **Saving & Tracking Grants**  
   Saved grants are stored in Firebase under user profiles, enabling real-time updates and easy tracking of application deadlines and funding opportunities.

5. **Deployment & Integration**  
   The backend runs entirely on Python \+ Firebase, providing a serverless architecture that is scalable, maintainable, and fully integrated with the Next.js frontend.

## **APIs:**

### **Firebase Firestore**

Firebase Firestore is used as the real-time database backbone of Granted, storing all grant records, user profiles, and saved grant data. Its serverless architecture ensures scalable, reliable access to data, enabling the frontend to retrieve grants instantly for swiping, browsing, and saving. Firestore’s structured document model allows efficient queries by fields such as issue areas, scope tags, agencies, and funding ranges, supporting both AI-powered match scoring and dynamic filtering.

### **Python**

Python serves as the core backend language for Granted, handling data ingestion, cleaning, AI match scoring, and filtering logic. Custom scripts process JSON/JSONL files to structure and normalize grants data before uploading to Firestore. Python is also used to compute relevance scores for each grant, powering the AI recommendations that drive the swipe-based interface and personalized grant suggestions.

### **JSON/JSONL Files**

Grants data is ingested from JSON and JSONL files, which contain raw grant information scraped from OurSG and other sources. These files are processed by Python scripts to extract relevant metadata, standardize fields, and generate Firestore-ready documents. This approach allows the system to easily update, expand, or correct the dataset while maintaining consistency across all grant records.

### **Client-Side Filtering & Search**

Granted implements advanced client-side filtering to enable multi-criteria searches across issue areas, scope tags, agencies, and funding ranges. This flexible filtering logic ensures that nonprofits can quickly narrow down grants to the most relevant opportunities. By performing complex queries client-side, the system overcomes Firestore’s querying limitations and delivers fast, interactive results without adding backend overhead.

## **Datasets:**

### **OurSG Grant Portal**

**Description:**  
A curated collection of 50 grants sourced from the OurSG Grants Portal, spanning various sectors and funding agencies across Singapore. Each entry includes detailed grant information such as title, agency, issue areas, scope tags, funding cap, eligibility criteria, application deadlines, and source URLs. This dataset serves as the primary corpus for grant discovery, enabling AI-powered relevance scoring, swipe-based exploration, and advanced multi-criteria filtering for nonprofits.

