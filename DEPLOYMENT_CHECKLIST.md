# Deployment Checklist

## Pre-Deployment

### Environment Variables
- [ ] `MONGODB_URI` - MongoDB connection string (Atlas recommended for production)
- [ ] `R2_ACCOUNT_ID` - Cloudflare R2 account ID
- [ ] `R2_ACCESS_KEY_ID` - R2 access key
- [ ] `R2_SECRET_ACCESS_KEY` - R2 secret key
- [ ] `R2_BUCKET_NAME` - R2 bucket name
- [ ] `R2_PUBLIC_URL` - Public URL for R2 bucket
- [ ] `R2_ENDPOINT` - R2 endpoint URL
- [ ] `ADMIN_EMAIL` - Admin login email
- [ ] `ADMIN_PASSWORD` - Strong admin password (change from default)
- [ ] `JWT_SECRET` - Strong random string (min 32 characters)
- [ ] `NEXT_PUBLIC_APP_URL` - Production domain URL
- [ ] `NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER` - WhatsApp business number

### Security
- [ ] Changed default `ADMIN_PASSWORD`
- [ ] Changed default `JWT_SECRET` to a strong random string
- [ ] MongoDB connection uses authentication
- [ ] R2 bucket has proper CORS configuration
- [ ] Environment variables are set in deployment platform (not in code)

### Database
- [ ] MongoDB Atlas cluster created
- [ ] Database user created with proper permissions
- [ ] IP whitelist configured (or 0.0.0.0/0 for all IPs)
- [ ] Connection string tested

### Storage
- [ ] Cloudflare R2 bucket created
- [ ] R2 API tokens generated
- [ ] CORS configured for your domain
- [ ] Public URL configured

### Build Verification
- [ ] `npm run build` completes successfully
- [ ] No critical errors in build output
- [ ] All pages compile correctly

## Deployment Steps

### Vercel (Recommended)
1. [ ] Push code to GitHub
2. [ ] Import project in Vercel
3. [ ] Add all environment variables
4. [ ] Deploy
5. [ ] Configure custom domain (optional)
6. [ ] Update `NEXT_PUBLIC_APP_URL` if using custom domain

### Other Platforms
1. [ ] Connect repository
2. [ ] Configure build settings:
   - Build command: `npm run build`
   - Output directory: `.next`
3. [ ] Add environment variables
4. [ ] Deploy

## Post-Deployment

### Functionality Tests
- [ ] Homepage loads correctly
- [ ] Product catalog displays products
- [ ] Product detail pages work
- [ ] Search functionality works
- [ ] Filter functionality works
- [ ] Admin login works
- [ ] Product creation/editing works
- [ ] Image uploads work
- [ ] Enquiry form submission works
- [ ] WhatsApp links work
- [ ] Cart functionality works
- [ ] Wishlist functionality works

### Performance
- [ ] Images load correctly from R2
- [ ] Page load times are acceptable
- [ ] No console errors in browser
- [ ] Mobile responsiveness works

### Security
- [ ] Admin routes are protected
- [ ] API routes validate authentication
- [ ] No sensitive data exposed in client-side code
- [ ] HTTPS is enabled (automatic on Vercel/Netlify)

## Monitoring Setup (Optional but Recommended)

- [ ] Error tracking (Sentry, LogRocket)
- [ ] Analytics (Google Analytics, Plausible)
- [ ] Uptime monitoring (UptimeRobot, Pingdom)
- [ ] Database monitoring (MongoDB Atlas)

## Rollback Plan

- [ ] Know how to rollback deployment
- [ ] Have previous working version tagged in Git
- [ ] Test rollback process

## Notes

- The application uses dynamic rendering for pages with `useSearchParams()`
- Console logs are disabled in production (only show in development)
- Image optimization is enabled via Next.js Image component
- Database connection pooling is configured for production
- API routes are marked as dynamic where needed

