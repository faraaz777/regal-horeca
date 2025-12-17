# Deployment Guide

This guide will help you deploy the Regal HoReCa application to production.

## Prerequisites

- Node.js 18+ installed
- MongoDB database (local or MongoDB Atlas)
- Cloudflare R2 account for image storage
- Domain name (optional but recommended)

## Environment Variables

Create a `.env.local` file (or set environment variables in your deployment platform) with the following:

### Required Variables

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/regal-horeca?retryWrites=true&w=majority

# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-bucket-name.r2.cloudflarestorage.com
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# Admin Authentication
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-secure-password-here
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long

# Application URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# WhatsApp Business Number (with country code, no + sign)
NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER=917093913311
```

### Optional Variables

```env
# Google Generative AI (for AI product descriptions)
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-api-key
```

## Deployment Platforms

### Vercel (Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Import project in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Configure Environment Variables**
   - In Vercel dashboard, go to Project Settings → Environment Variables
   - Add all required environment variables from above
   - Make sure to set them for Production, Preview, and Development environments

4. **Deploy**
   - Vercel will automatically build and deploy
   - Your app will be live at `your-project.vercel.app`

5. **Custom Domain (Optional)**
   - Go to Project Settings → Domains
   - Add your custom domain
   - Update `NEXT_PUBLIC_APP_URL` to match your domain

### Other Platforms

#### Netlify

1. Connect your GitHub repository
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Add all environment variables in Netlify dashboard

#### Railway

1. Connect your GitHub repository
2. Railway will auto-detect Next.js
3. Add environment variables in Railway dashboard
4. Deploy!

#### AWS Amplify

1. Connect your repository
2. Build settings:
   - Build command: `npm run build`
   - Output directory: `.next`
3. Add environment variables
4. Deploy

## MongoDB Setup

### MongoDB Atlas (Recommended for Production)

1. Create account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create database user
4. Whitelist your deployment platform's IP (or use 0.0.0.0/0 for all IPs)
5. Get connection string and add to `MONGODB_URI`

### Local MongoDB

Not recommended for production. Use MongoDB Atlas instead.

## Cloudflare R2 Setup

1. **Create R2 Bucket**
   - Log in to Cloudflare dashboard
   - Go to R2 Object Storage
   - Create a new bucket

2. **Generate API Tokens**
   - Go to R2 → Manage R2 API Tokens
   - Create API token with read/write permissions
   - Copy Account ID, Access Key ID, and Secret Access Key

3. **Configure CORS**
   - In bucket settings, configure CORS to allow your domain
   - Example CORS config:
     ```json
     [
       {
         "AllowedOrigins": ["https://yourdomain.com"],
         "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
         "AllowedHeaders": ["*"],
         "ExposeHeaders": ["ETag"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```

4. **Set Public URL**
   - Use R2's public URL or configure custom domain
   - Add to `R2_PUBLIC_URL` environment variable

## Post-Deployment Checklist

- [ ] All environment variables are set correctly
- [ ] MongoDB connection is working
- [ ] R2 image uploads are working
- [ ] Admin login is functional
- [ ] Product images are loading correctly
- [ ] WhatsApp links are working
- [ ] Custom domain is configured (if applicable)
- [ ] SSL certificate is active (automatic on Vercel/Netlify)
- [ ] Test product creation/editing
- [ ] Test enquiry form submission
- [ ] Verify API routes are accessible

## Performance Optimization

The application includes:
- ✅ Image optimization with Next.js Image component
- ✅ Database connection pooling
- ✅ API response caching
- ✅ SWR for client-side data fetching
- ✅ Production-ready error handling

## Security Checklist

- [ ] `JWT_SECRET` is a strong random string (min 32 characters)
- [ ] `ADMIN_PASSWORD` is strong and unique
- [ ] MongoDB connection string uses authentication
- [ ] R2 credentials are secure
- [ ] Environment variables are not exposed in client-side code
- [ ] API routes have proper error handling

## Monitoring

Consider setting up:
- Error tracking (Sentry, LogRocket)
- Analytics (Google Analytics, Plausible)
- Uptime monitoring (UptimeRobot, Pingdom)
- Database monitoring (MongoDB Atlas monitoring)

## Troubleshooting

### Build Errors

- Check all environment variables are set
- Verify Node.js version is 18+
- Check for TypeScript errors: `npm run lint`

### Database Connection Issues

- Verify `MONGODB_URI` is correct
- Check IP whitelist in MongoDB Atlas
- Verify database user has correct permissions

### Image Upload Issues

- Verify all R2 environment variables are set
- Check R2 bucket CORS configuration
- Verify R2 API tokens have correct permissions

### API Errors

- Check server logs in deployment platform
- Verify environment variables are accessible
- Check MongoDB connection status

## Support

For issues or questions:
1. Check server logs in your deployment platform
2. Verify all environment variables are set
3. Test API endpoints individually
4. Check MongoDB and R2 service status

