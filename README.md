# Regal HoReCa Catalog

A modern, production-ready Next.js application for managing and displaying a HoReCa (Hotel, Restaurant, Café) product catalog.

## Features

- 🛍️ **Product Catalog** - Browse and search products with advanced filtering
- 🔐 **Admin Dashboard** - Manage products, categories, and business types
- 📸 **Cloudflare R2 Integration** - Automatic image uploads to Cloudflare R2
- 🗄️ **MongoDB Database** - Scalable data storage with Mongoose
- 💝 **Wishlist** - Save favorite products
- 📱 **Responsive Design** - Mobile-first, modern UI
- 🔒 **Secure Authentication** - JWT-based admin authentication

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: MongoDB with Mongoose
- **Storage**: Cloudflare R2 (S3-compatible)
- **Styling**: Tailwind CSS
- **Authentication**: JWT tokens

## Prerequisites

- Node.js 18+ and npm/yarn
- MongoDB database (local or MongoDB Atlas)
- Cloudflare R2 account with bucket configured

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd regal-horeca-catalog
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/regal-horeca
   # Or use MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/regal-horeca

   # Cloudflare R2 Configuration
   R2_ACCOUNT_ID=your-r2-account-id
   R2_ACCESS_KEY_ID=your-r2-access-key-id
   R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
   R2_BUCKET_NAME=your-bucket-name
   R2_PUBLIC_URL=https://your-bucket-name.r2.cloudflarestorage.com
   # Or use custom domain:
   # R2_PUBLIC_URL=https://cdn.yourdomain.com

   # Admin Authentication
   ADMIN_EMAIL=admin@regal.com
   ADMIN_PASSWORD=Admin@123456
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # WhatsApp Business Number (with country code, no + sign)
   # Example: 917093913311 for India (91 is country code + 7093913311)
   NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER=917093913311
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── admin/             # Admin pages
│   ├── catalog/           # Catalog page
│   ├── products/          # Product detail pages
│   └── layout.js          # Root layout
├── components/            # React components
├── context/               # React Context providers
├── lib/                   # Utility libraries
│   ├── db/               # Database connection
│   ├── models/           # Mongoose models
│   └── utils/            # Utility functions
└── public/               # Static assets
```

## API Routes

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/[id]` - Get single product
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/[id]` - Update product (admin only)
- `DELETE /api/products/[id]` - Delete product (admin only)

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category (admin only)

### Business Types
- `GET /api/business-types` - Get all business types
- `POST /api/business-types` - Create business type (admin only)

### Upload
- `POST /api/upload` - Upload image to R2 (admin only)

### Admin
- `POST /api/admin/login` - Admin login

## Admin Access

1. Navigate to `/admin/login`
2. Use the credentials from your `.env.local` file:
   - Email: `admin@regal.com` (or your configured email)
   - Password: `Admin@123456` (or your configured password)

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- DigitalOcean App Platform

Make sure to set all environment variables in your deployment platform.

## Cloudflare R2 Setup

1. Create a Cloudflare account
2. Go to R2 Object Storage
3. Create a bucket
4. Generate API tokens with read/write permissions
5. Configure CORS for your domain
6. Add the credentials to your `.env.local` file

## MongoDB Setup

### Local MongoDB
1. Install MongoDB locally
2. Start MongoDB service
3. Use connection string: `mongodb://localhost:27017/regal-horeca`

### MongoDB Atlas
1. Create a MongoDB Atlas account
2. Create a cluster
3. Get connection string
4. Add to `.env.local` as `MONGODB_URI`

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Code Structure

The codebase follows industry best practices:
- **Modular Architecture** - Separated concerns with clear boundaries
- **Clean Code** - Well-commented, easy to understand
- **Scalable** - Designed to handle growth
- **Type Safety** - Using JSX with proper prop validation
- **Error Handling** - Comprehensive error handling throughout

## License

Copyright © 2024 Regal Brass & Steelware. All Rights Reserved
