# Somnium

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Local Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Development with GitHub Codespaces

GitHub Codespaces provides a cloud-based development environment that's perfect for this project:

1. **Open in Codespaces:**

   - Click the "Code" button on your GitHub repository
   - Select "Codespaces" tab
   - Click "Create codespace on main"

2. **Using GitHub Copilot in Codespaces:**

   - Copilot is automatically available in the VS Code environment
   - Use `Ctrl+I` (or `Cmd+I` on Mac) to open Copilot Chat
   - Use `Tab` to accept Copilot suggestions as you type
   - Ask Copilot to help with:
     - Writing React components
     - Styling with Tailwind CSS
     - Debugging issues
     - Adding new features

3. **Making Changes:**
   - Edit files directly in the Codespaces editor
   - Use Copilot to generate boilerplate code
   - Test changes in the integrated terminal with `npm run dev`
   - Commit and push changes directly from Codespaces

## Deployment

### Deploy to Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

#### Method 1: Deploy from GitHub (Recommended)

1. **Push your code to GitHub:**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel:**

   - Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will automatically detect it's a Next.js project
   - Click "Deploy" (no configuration needed)

3. **Automatic Deployments:**
   - Every push to `main` branch will trigger a new deployment
   - Pull requests will create preview deployments
   - Deployments are available at `https://your-project-name.vercel.app`

#### Method 2: Deploy with Vercel CLI

1. **Install Vercel CLI:**

   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```
   - Follow the prompts to link your project
   - Choose your team/account
   - Deploy to production

### Attaching a Custom Domain

1. **In Vercel Dashboard:**

   - Go to your project dashboard
   - Click on "Settings" tab
   - Navigate to "Domains" section

2. **Add Domain:**

   - Enter your domain name (e.g., `yoursite.com`)
   - Click "Add"
   - Vercel will provide DNS records to configure

3. **Configure DNS:**

   - Go to your domain registrar (GoDaddy, Namecheap, etc.)
   - Add the DNS records provided by Vercel:
     - **A Record:** `@` → `76.76.19.61`
     - **CNAME Record:** `www` → `cname.vercel-dns.com`
   - Wait for DNS propagation (5-60 minutes)

4. **SSL Certificate:**

   - Vercel automatically provisions SSL certificates
   - Your site will be available at `https://yoursite.com`

5. **Verify Domain:**
   - Check that your domain resolves correctly
   - Test both `yoursite.com` and `www.yoursite.com`

### Environment Variables (if needed)

If your project uses environment variables:

1. **In Vercel Dashboard:**

   - Go to Project Settings → Environment Variables
   - Add your variables for Production, Preview, and Development

2. **In your code:**
   ```javascript
   // Access environment variables
   const apiKey = process.env.NEXT_PUBLIC_API_KEY;
   ```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Vercel Deployment Guide](https://vercel.com/docs/deployments/overview) - comprehensive deployment documentation.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Troubleshooting

### Common Issues

1. **Build Failures:**

   - Check the Vercel build logs for specific errors
   - Ensure all dependencies are in `package.json`
   - Verify TypeScript compilation passes locally

2. **Domain Not Working:**

   - Verify DNS records are correctly set
   - Check domain propagation with tools like `dig` or online DNS checkers
   - Ensure domain is not using conflicting DNS settings

3. **Environment Variables:**
   - Make sure variables are set in Vercel dashboard
   - Use `NEXT_PUBLIC_` prefix for client-side variables
   - Redeploy after adding new environment variables
