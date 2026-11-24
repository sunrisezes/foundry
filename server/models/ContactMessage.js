import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  topic: {
    type: String,
    enum: ['General question', 'Technical help', 'Report concern', 'Privacy request', 'Other'],
    required: true
  },
  message: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
  status: { type: String, enum: ['new', 'reviewed', 'resolved'], default: 'new', index: true }
}, { timestamps: { createdAt: true, updatedAt: true } });

export default mongoose.model('ContactMessage', contactMessageSchema);
