# MediScan AI (DiagNXT)

AI-assisted clinical triage and health intelligence platform built for public health facilities.

### Clinical Decision Support & Intelligence
- **Dataset:** 10,045 Andhra Pradesh outpatient (OPD) records from PHCs/UPHCs
- **Analytics:** Outbreak detection, complaint prediction, clinical risk stratification, and treatment recommendations.

#### Andhra Pradesh OPD Dataset Validation (10,045 Records)
| Dimension | Verified Metric |
|---|---|
| **Total Recorded Encounters** | **10,045 OP visits** (`ap_hackathon_data- Worksheet.csv`) |
| **Unique Patient Population** | 9,987 distinct patient IDs |
| **Facility Breakdown** | 6,763 Primary Health Centres (PHCs) · 3,282 Urban PHCs (UPHCs) |
| **Public Healthcare Facilities** | 1,112 public health facilities across Andhra Pradesh |
| **District Distribution** | East Godavari (1,090), Krishna (1,007), West Godavari (917), Visakhapatnam (785), Guntur (745), Nellore (724), Vizianagaram (696), Srikakulam (659), Prakasam (601), Kurnool (473), Chittoor (397), Ananthapuramu (286), YSR Kadapa (261) |
| **Clinical Schema** | 39 columns (vitals, chief complaints, severity, duration, onset, prescribed treatments, lab recommendations, test values) |

## Project info

## Deployment

You can deploy this project to Vercel or any other static hosting provider.

## Custom Domain

To configure a custom domain, please refer to your hosting provider's documentation.

## How can I edit this code?

There are several ways of editing your application.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS


