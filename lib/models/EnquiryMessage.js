/**
 * EnquiryMessage Model
 * 
 * Defines the schema for communication log entries for enquiries.
 * Stores admin notes, message drafts, and communication history.
 */

import mongoose from 'mongoose';

const EnquiryMessageSchema = new mongoose.Schema({
  enquiryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enquiry',
    required: true,
    index: true,
  },
  sender: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'admin',
    required: true,
  },
  channel: {
    type: String,
    enum: ['whatsapp', 'phone', 'email', 'internal-note'],
    default: 'internal-note',
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  createdBy: {
    type: String,
    trim: true,
    default: '', // Admin name/email who created this message
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Index for faster queries
EnquiryMessageSchema.index({ enquiryId: 1, createdAt: -1 });

const EnquiryMessage = mongoose.models.EnquiryMessage || mongoose.model('EnquiryMessage', EnquiryMessageSchema);

export default EnquiryMessage;

