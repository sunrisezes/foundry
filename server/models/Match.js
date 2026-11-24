import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  lostItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  foundItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  visualScore: { type: Number, required: true, min: 0, max: 1 },
  locationScore: { type: Number, required: true, min: 0, max: 1 },
  categoryScore: { type: Number, required: true, min: 0, max: 1 },
  totalScore: { type: Number, required: true, min: 0, max: 1, index: true },
  status: { type: String, enum: ['pending', 'confirmed', 'dismissed'], default: 'pending', index: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

matchSchema.index({ lostItem: 1, foundItem: 1 }, { unique: true });

export default mongoose.model('Match', matchSchema);
