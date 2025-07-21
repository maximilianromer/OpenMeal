
# OpenMeal - A Privacy-First, AI-Powered Nutrition Tracker

## Overview

OpenMeal is an open-source, privacy-focused mobile nutrition tracker built with React Native and Expo. It leverages on-device machine learning and Google's Gemini API to provide users with detailed nutritional analysis from photos of their meals. All user data is stored locally, ensuring complete privacy.

This README provides a technical overview of the OpenMeal project, intended for developers and contributors.

**[You can view the project website at https://maximilianromer.github.io/OpenMeal/](https://maximilianromer.github.io/OpenMeal/)**.

## Table of Contents

- [Technical Stack](#technical-stack)
- [Project Architecture](#project-architecture)
- [Core Functionality & Implementation](#core-functionality--implementation)
  - [Meal Analysis with Gemini](#meal-analysis-with-gemini)
  - [Health Connect Integration](#health-connect-integration)
  - [Data Persistence](#data-persistence)
  - [State Management](#state-management)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
- [Acknowledgements](#Acknowledgements)

## Technical Stack

- **Framework:** [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **State Management:** React Context API & Hooks
- **Navigation:** [Expo Router](https://docs.expo.dev/router/introduction/)
- **AI:** [Google Gemini API](https://ai.google.dev/) for multimodal meal analysis
- **Health Data:** [Android Health Connect](https://developer.android.com/health-and-fitness/guides/health-connect) via `react-native-health-connect`
- **Data Storage:** Local file system via `expo-file-system` and `expo-secure-store`
- **Linting:** [ESLint](https://eslint.org/)
- **Testing:** [Jest](https://jestjs.io/) for unit tests.

## Project Architecture

The application is architected with a service-oriented approach, separating concerns into distinct modules. This design enhances maintainability, scalability, and testability.

-   **`app/`**: Contains the application's screens and navigation logic, powered by Expo Router. The file-based routing system defines the app's URL structure and screen hierarchy.
-   **`components/`**: A library of reusable UI components. This includes everything from basic elements like themed text and views to complex modals and charts.
-   **`services/`**: The core of the application's business logic. Each service encapsulates a specific domain of functionality (e.g., `GeminiService`, `HealthConnectService`, `FileSystemStorageService`). This separation allows for easier management and testing of individual features.
-   **`hooks/`**: Custom React hooks that provide reusable logic to components, such as `useColorScheme` for theme management.
-   **`constants/`**: Application-wide constants, including colors, fonts, and other configuration values.
-   **`types/`**: TypeScript type definitions, including custom declarations for libraries like `react-native-health-connect`.

## Core Functionality & Implementation

### Meal Analysis with Gemini

The `GeminiService.ts` is responsible for interacting with the Google Gemini API.

-   **Multimodal Input:** It takes a base64-encoded image of a meal and a text prompt as input.
-   **API Interaction:** It constructs a request to the Gemini API endpoint, sending the image and prompt for analysis.
-   **Structured Output:** The service is configured to expect a structured JSON response from the API, which includes detailed nutritional information (calories, protein, carbs, fats), a meal name, and a confidence score. This is achieved by defining a `responseSchema` in the `generationConfig`.

### Health Connect Integration

Integration with Android's Health Connect is managed by `HealthConnectService.ts`.

-   **Data Synchronization:** It provides methods to write meal data (total calories, protein, carbs, fat) to Health Connect, associating it with the correct time and meal type.
-   **Permissions:** The service handles the process of checking for and requesting user permissions to read and write nutritional data.

### Data Persistence

All user data, including meal history, user profile, and daily goals, is stored locally on the user's device using `expo-file-system`.

-   **`FileSystemStorageService.ts`**: This service provides a simple key-value store abstraction over the file system. It handles serialization and deserialization of JSON data, making it easy to store and retrieve complex objects.
-   **Data Models:** Services like `UserProfileService.ts` and `DailyGoalsService.ts` use the storage service to persist their respective data models.
-   **Privacy by Design:** By storing data locally, the app ensures that sensitive user information never leaves the device, providing a high level of privacy.

### State Management

The application utilizes React's built-in Context API and custom hooks for state management.

-   **Decentralized State:** Instead of a single global store, state is managed by multiple contexts, each responsible for a specific slice of the application's state (e.g., `OnboardingContext`, `MealContext`).
-   **Service-Oriented Contexts:** Context providers often wrap the logic from the `services` directory, providing a clean API for components to interact with the application's business logic. For example, the `MealContext` will use the `AnalysisProcessor` and `FileSystemStorageService` to manage meal data.

## Getting Started

### Prerequisites

-   [Node.js and NPM](https://nodejs.org/en/) (LTS version recommended)
-   [Expo Go](https://expo.dev/go) app on your Android device for testing
-   [A Gemini API key](https://aistudio.google.com/apikey), which can be used for free with all currently released Gemini models at high rate limits.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/maximilianromer/OpenMeal](https://github.com/maximilianromer/OpenMeal.git)
    cd OpenMeal
    ```

2.  **Install dependencies:**
    ```
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add your Gemini API key:
    ```
    GEMINI_API_KEY=your_api_key_here
    EXPO_PROJECT_ID=your_project_id_here
    ```

### Running the App

1.  **Start the development server:**
    ```
    npx expo start
    ```

## Acknowledgements
I built this app in about a month of summer break, with no prior experience in mobile app development or React Native. A few tools were instrumental to my success:
 - [Cursor:](https://cursor.com/) an excellent AI code editor, with a powerful agent that wrote 99% of the app's code
 - [Anthropic's Claude 4 models:](https://www.anthropic.com/) By far the most adept at code writing and tool calling for agentic editing. I used these for 99% of actual code edits and implementation work.
 - [Google Gemini:](https://deepmind.google/) a plethora of free tools that made this project possible
	 - [API free tier:](https://ai.google.dev/gemini-api/docs/pricing) opened the possibility of building open tools that rely upon LLMs like this, with no cost. I have probably used hundreds of dollars of inference off this; it is a true act of altruism
	 - [Gemini 2.5 Pro model:](https://aistudio.google.com/) Fantastic long-context analysis of the codebase, which helped me plan features and detect issues.
