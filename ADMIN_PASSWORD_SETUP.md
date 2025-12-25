# Admin Password Protection

Simple password gate for admin routes - no JWT, no database, no complicated auth system.

## How It Works

1. When accessing any `/admin/*` route, a password modal appears
2. Enter the predefined password to access admin pages
3. Password is stored in sessionStorage (auto-logout on tab close)
4. Logout button in sidebar to manually logout

## Environment Variable

Add this to your `.env.local` file:

```env
NEXT_PUBLIC_ADMIN_PASSWORD=admin123456
```

**Important:** 
- Must start with `NEXT_PUBLIC_` to be accessible on client-side
- Change `admin123456` to your desired password
- No restart needed - just update `.env.local` and rebuild

## Default Password

If `NEXT_PUBLIC_ADMIN_PASSWORD` is not set, the default password is `admin123456`.

## Features

✅ Simple password modal popup  
✅ Password stored in environment variable  
✅ Auto-logout on tab close (sessionStorage)  
✅ Logout button in sidebar  
✅ Protects all admin routes automatically  
✅ No JWT, no database, no users table  

## Usage

1. Navigate to any admin route: `/admin/dashboard`, `/admin/products`, etc.
2. Password modal appears automatically
3. Enter password from `NEXT_PUBLIC_ADMIN_PASSWORD`
4. Access granted - you can now use admin features
5. Click "Logout" in sidebar to logout manually
6. Closing the browser tab also logs you out automatically

