import mongoose from 'mongoose';

export const ITEM_CATEGORIES = [
  'Electronics', 'ID & Cards', 'Bags & Wallets', 'Keys',
  'Bottles & Accessories', 'Books & Notes', 'Other'
];

export const CAMPUS_ZONES = [
  'Library', 'Student Center', 'Science Building', 'Engineering Building',
  'Arts Building', 'Administration', 'Sports Complex', 'Residence Hall',
  'Dining Hall', 'Other'
];

const itemSchema = new mongoose.Schema({
  type: { type: String, enum: ['lost', 'found'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, enum: ITEM_CATEGORIES, required: true, index: true },
  imageUrl: { type: String, required: true },
  embedding: { type: [Number], required: true, select: false },
  locationTag: { type: String, enum: CAMPUS_ZONES, required: true, index: true },
  specificSpot: { type: String, trim: true, maxlength: 160, default: '' },
  itemDate: { type: Date, required: true, index: true },
  verificationQuestion: { type: String, trim: true, maxlength: 300, default: '' },
  status: { type: String, enum: ['open', 'matched', 'claimed', 'resolved'], default: 'open', index: true },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: { createdAt: true, updatedAt: true } });

itemSchema.index({ status: 1, type: 1, category: 1, createdAt: -1 });

export default mongoose.model('Item', itemSchema);
