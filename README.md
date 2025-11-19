# Zenith Food WMS
A visually stunning and highly performant cloud-based Food Warehouse Management System for real-time inventory, order, and shipment tracking.
[cloudflarebutton]
Zenith Food WMS is a modern, minimalist, and powerful cloud-based Warehouse Management System designed for companies handling food products. Built on Cloudflare's edge network, it offers lightning-fast performance and real-time data synchronization. The system provides a centralized dashboard for monitoring key metrics, detailed modules for inventory management with expiry date tracking, order processing, and shipment tracking. Role-based access control ensures that staff members only see the information and tools relevant to their roles. The user interface is designed with a focus on clarity, efficiency, and visual elegance, minimizing clicks and presenting complex food-related data in an intuitive, actionable format.
## Key Features
-   **Real-time Dashboard:** Get a high-level overview of warehouse operations with key performance indicators.
-   **Food Inventory Management:** A comprehensive view of all food products with expiry date tracking, storage temperature monitoring, and allergen information.
-   **Order Processing:** Manage sales and purchase orders through a clean, tabbed interface.
-   **Shipment Tracking:** Monitor inbound and outbound shipments, carrier information, and statuses.
-   **Reporting & Analytics:** Generate insightful reports on inventory turnover, fulfillment times, and efficiency.
-   **Settings & User Management:** Administrative panel for managing users, roles, and warehouse locations.
## Technology Stack
-   **Frontend:** React, Vite, React Router, Tailwind CSS
-   **UI Components:** shadcn/ui, Lucide React, Recharts, Framer Motion
-   **Backend:** Hono on Cloudflare Workers
-   **Storage:** Cloudflare Durable Objects
-   **State Management:** Zustand
-   **Forms:** React Hook Form with Zod for validation
-   **Language:** TypeScript
## Project Structure
The project is organized into three main directories:
-   `src/`: Contains the frontend React application, including pages, components, hooks, and utility functions.
-   `worker/`: Contains the Hono backend application running on a Cloudflare Worker, including API routes, entity definitions, and core Durable Object logic.
-   `shared/`: Contains shared code, primarily TypeScript types, used by both the frontend and backend to ensure type safety.
## Getting Started
Follow these instructions to get the project up and running on your local machine for development and testing purposes.
### Prerequisites
-   [Bun](https://bun.sh/) installed on your machine.
-   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) for interacting with the Cloudflare platform.
### Installation
1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd zenith_wms
    ```
2.  **Install dependencies:**
    This project uses Bun as the package manager.
    ```bash
    bun install
    ```eeeee
### Running Locally
To start the development server, which includes both the Vite frontend and the Wrangler server for the backend, run:
```bash
bun dev
```
This will start the application, typically available at `http://localhost:3000`.
## Development
### Frontend
-   **Pages:** New pages can be added in the `src/pages` directory.
-   **Components:** Reusable components are located in `src/components`. We heavily utilize `shadcn/ui` components, which can be imported from `@/components/ui/...`.
-   **API Calls:** Use the `api` client helper in `src/lib/api-client.ts` to make type-safe requests to the backend.
### Backend
-   **API Routes:** Add new API endpoints in `worker/user-routes.ts`. The Hono app instance is passed to this function from `worker/index.ts`.
-   **Entities:** To manage new types of data, create new `Entity` or `IndexedEntity` classes in `worker/entities.ts`. This pattern abstracts away direct interaction with the Durable Object.
-   **Types:** Always define shared data structures in `shared/types.ts` to maintain consistency between the client and server.
## Deployment
This project is designed for seamless deployment to Cloudflare's global network.
1.  **Login to Wrangler:**
    If you haven't already, authenticate Wrangler with your Cloudflare account:
    ```bash
    wrangler login
    ```
2.  **Deploy the application:**
    Run the deploy script, which will build the application and deploy it using Wrangler.
    ```bash
    bun run deploy
    ```
Alternatively, you can deploy directly from your GitHub repository using the button below.
[cloudflarebutton]