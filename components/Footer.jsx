/**
 * Footer Component
 * 
 * Site footer with links, contact information, and copyright.
 */

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-secondary text-light overflow-x-hidden">
      <div className="max-w-screen-xl mx-auto px-4 py-12 overflow-x-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4 text-white">REGAL</h3>
            <p className="text-gray-400">
              Your trusted partner in the HoReCa industry for over 45 years. Providing quality and excellence.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4 text-white">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link href="/aboutus" className="text-gray-400 hover:text-white">About Us</Link></li>
              <li><Link href="/catalog" className="text-gray-400 hover:text-white">Products</Link></li>
              <li><Link href="/contact" className="text-gray-400 hover:text-white">Contact</Link></li>
              <li><Link href="/faq" className="text-gray-400 hover:text-white">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4 text-white">Contact Us</h4>
            <address className="not-italic text-gray-400 space-y-2">
              <p>Begum Bazar, Hyderabad</p>
              <p>Phone: +91 12345 67890</p>
              <p>Email: sales@regal.com</p>
            </address>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4 text-white">Follow Us</h4>
            <div className="flex space-x-4">{/* Social icons */}</div>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-700 pt-6 text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} Regal Brass & Steelware. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}