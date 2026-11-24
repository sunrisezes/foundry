# Campus Lost & Found

A MERN application for reporting lost and found items, discovering visual matches, and coordinating claims.

## Features

- Post lost or found items with images and discover potential visual matches.
- Submit and manage claims, including verified handovers.
- Contact administrators and manage contact submissions.
- Let report owners restore removed reports; administrators can manage active report statuses.
- Use a local Transformers.js CLIP model for visual matching, with a Sharp-based descriptor fallback.

## Requirements

- Node.js 20.13 or later
- MongoDB, local or hosted

## Run locally

1. Copy `server/.env.example` to `server/.env`.
2. Set `MONGODB_URI` to your MongoDB connection string and replace `JWT_SECRET` with a random value at least 32 characters long.
3. From the project root, install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

The client is available at `http://localhost:5173`; the API is available at `http://localhost:5000`. Check `http://localhost:5000/api/health` to verify the API is running.

## Configuration

The server reads these variables from `server/.env`:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | API server port. |
| `MONGODB_URI` | — | Required MongoDB connection string. |
| `JWT_SECRET` | — | Required signing secret, at least 32 characters. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed client origin(s); separate multiple origins with commas. |
| `UPLOAD_DIR` | `uploads` locally; `/tmp/campus-lost-found-uploads` on Vercel | Temporary upload directory. |
| `BLOB_READ_WRITE_TOKEN` | — | Required on Vercel for durable image uploads; configure only on the API project. |
| `VISION_OFFLINE` | `0` locally | Set to `1` to skip downloading the CLIP model and use the Sharp-based descriptor. Vercel always uses the Sharp-based descriptor. |

When `VISION_OFFLINE` is not enabled, the server attempts to load the CLIP model. If the model weights cannot be downloaded, it logs the reason and uses the Sharp-based descriptor instead. No paid external API is used.

## Build, test, and production

- Build the client: `npm run build`
- Run server tests: `npm test --workspace server`
- For production, build the client and start the server with `NODE_ENV=production`; the server then serves the built client from `client/dist`.

In local development, uploaded images are stored on disk and served by the API from `/uploads`.

## Deploy both projects on Vercel

This repository contains two Vercel projects. Import the GitHub repository twice and set each project's **Root Directory**:

1. **Client:** `client` (Vercel should detect Vite). Add `VITE_API_URL` with the deployed API project's origin, for example `https://your-api.vercel.app`, without a trailing slash. The `client/vercel.json` rewrite supports client-side routes such as `/admin/reports`.
2. **API:** `server` (Vercel should detect Express). Add `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, and `CLIENT_ORIGIN` set to the client project's production origin. Ensure the MongoDB provider allows connections from the deployed API.

For durable image storage, create a **public** Vercel Blob store and connect it to the API project with `BLOB_READ_WRITE_TOKEN`. Keep this token server-side; do not add it to the client project. The API uses Vercel Blob for uploaded images and temporary storage only while processing an upload. Vercel uses the Sharp-based visual descriptor instead of downloading the CLIP model.

Deploy the API first, then set its origin as `VITE_API_URL` in the client project and deploy the client. Verify the API at `https://your-api.vercel.app/api/health`. Add any Vercel preview or custom client origins to `CLIENT_ORIGIN` as comma-separated values if those deployments need API access.

Existing database records that point to local `/uploads/...` files are not migrated automatically; move those images to Blob and update their `imageUrl` values before using that data on Vercel. If existing records use CLIP embeddings, recompute them with the Sharp-based descriptor too so new and existing items can match.

## Administration and deployment notes

New accounts are regular users. Assign the `admin` role through a trusted database operation to create an administrator; there is no public admin-registration flow. Administrators can manage report statuses at `/admin/reports` and review contact submissions at `/admin/contact`.

Removed reports are hidden from public listings but retained with their image and audit information. Owners can restore their reports from **My reports**.

Review the policy text in `client/src/App.jsx` and adapt it to your institution's requirements before deployment.
