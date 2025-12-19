/**
 * Enquiry Summary Component
 * 
 * Shows a small summary strip before redirecting to WhatsApp
 * Allows users to change details if needed
 */

'use client';

import { useState } from 'react';
import { PhoneIcon, UserIcon, EditIcon } from './Icons';
import LightCaptureModal from './LightCaptureModal';

export default function EnquirySummary({ 
  phone, 
  userType, 
  onConfirm, 
  onEdit,
  productCount = 0 
}) {
  const [showEditModal, setShowEditModal] = useState(false);

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else {
      setShowEditModal(true);
    }
  };

  const handleEditSubmit = async ({ phone: newPhone, name: newName, userType: newUserType }) => {
    // Update and confirm with new details
    if (onConfirm) {
      await onConfirm({ phone: newPhone, name: newName, userType: newUserType });
    }
    setShowEditModal(false);
  };

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <PhoneIcon className="w-4 h-4 text-blue-600" />
              <span className="font-medium">{phone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <UserIcon className="w-4 h-4 text-blue-600" />
              <span className="font-medium">
                {userType === 'business' ? '🏢 Business' : '👤 Customer'}
              </span>
            </div>
            {productCount > 0 && (
              <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                {productCount} item{productCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={handleEdit}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 underline"
          >
            <EditIcon className="w-3 h-3" />
            Change
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          You are enquiring as shown above. Click "Change" to update.
        </p>
      </div>

      {/* Edit Modal */}
      <LightCaptureModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditSubmit}
        defaultUserType={userType}
      />
    </>
  );
}

