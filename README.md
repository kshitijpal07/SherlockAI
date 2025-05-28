# AI-Powered Criminal Detection System (CrimeVision AI)

## Overview

This AI-driven system enhances criminal detection by analyzing both CCTV footage and real-time video feeds. It integrates advanced GAN-based sketch-to-image conversion, face detection, and face recognition to identify suspects with high accuracy. The system enables law enforcement and security agencies to recognize individuals using AI-enhanced facial analysis, reducing manual effort in video surveillance.

## Features

1. CCTV Footage Analyzer – Detects and identifies faces from pre-recorded security footage.
2. Real-Time Monitoring System – Performs live face recognition for instant suspect identification.
3. Sketch-to-Image Feature – Converts rough sketches into realistic colorized images for enhanced facial matching.
4. Database Storage – Stores extracted face feature vectors, names, and locations for quick retrieval and matching.

## Team Members

1. [Mit Gandhi](https://github.com/Mit-Gandhi) 
2. [Rishit Srivastava](https://github.com/rishitsrivastav) 
3. [Kritansh Tank](https://github.com/Kritansh-Tank)

## Tech Stack

### Frontend

1. React.js – UI development
2. Vite.js – Fast build tool for React
3. TypeScript – Ensures type safety

### Backend

1. FastAPI – High-performance API for handling image processing and recognition requests
2. Python – Core language for AI and backend processing
3. GAN Models – AI-based image generation for sketch-to-photo conversion
4. InsightFace (IR-SE50) – Face detection and feature extraction
5. FAISS – Fast similarity search for efficient face matching

## Installation & Setup

### Clone the Repository

```
git clone https://github.com/Mit-Gandhi/HackOverflow-AI_Mavericks.git  
cd AI-Criminal-Detection
```

### Backend Setup

#### Install required dependencies:

```
pip install -r backend/requirements.txt
```

#### Run the FastAPI server:
```
cd backend
uvicorn backend.main:app --reload
```

### Frontend Setup:
```
cd frontend  
npm install  
npm run dev  
```

## System Workflow

### User Authentication 

```/register``` – New users can create an account and log in.

```/login``` – Existing users authenticate to access the system.

### Home Page

```/home``` – The dashboard provides access to all major functionalities, including CCTV analysis, live monitoring, and sketch-to-image conversion.

### CCTV Footage Analysis

```/analyze``` – Users upload CCTV footage to detect and identify suspects.
1. The system extracts frames and detects faces using InsightFace.
2. Feature vectors are extracted using InsightFace (IR-SE50).
3. The system compares detected faces against stored records using FAISS.
4. If a match is found, it returns timestamps of all occurrences and generates trimmed video clips showing only the suspect.
   
```/analyze/report``` – Users can preview and download a detailed report with suspect information, timestamps, and video evidence.

### Live Surveillance Monitoring

```/live``` – The system connects to live surveillance feeds to detect suspects in real-time.
1. Faces are identified continuously and compared with database records.
2. If a suspect is detected, their name, location, and match confidence are displayed.
3. Alerts are triggered via Firebase Cloud Messaging (FCM) for immediate action.

### Sketch-to-Image Generation

```/sketch``` – Converts a monotone sketch into a realistic colorized image using a GAN-based model.
1. This feature enhances low-quality evidence and improves face recognition performance.

### Database Storage & Management

```/records``` – Stores and manages police records for suspect identification.
1. The system maintains a structured database of face feature vectors, names, and locations in Firebase Firestore.
2. This allows cross-referencing and information sharing between different law enforcement agencies.

## End-to-End Workflow Summary

1. Register/Login → Access dashboard.
2. Upload CCTV footage or connect live feed → Face detection & recognition.
3. Retrieve timestamps & suspect clips → Download reports for further investigation.
4. Convert sketches to images → Enhance face recognition from incomplete evidence.
5. Manage stored records → Maintain an updated police database for future references.

## Screenshots

### Home Page

![Home Page](https://drive.google.com/uc?id=1kYCgqDOybxI_QMLhSHZ_WNXJFdyzQfsV)


### CCTV Analyzer

![CCTV Analyzer](https://drive.google.com/uc?id=1BdsjhVkVrMhWtnMUJZ2HbIm-v4UU05eH)


### Live Feed Monitoring

![Live Feed Monitoring](https://drive.google.com/uc?id=1CzHHHnPFlNwUy4PyaEGWaxgBsA9aP_Mj)


### Sketch to Color Image

![Live Feed Monitoring](https://drive.google.com/uc?id=12mOG3yrD20zNT4TjnoyRXCtqM8JbHSQE)


