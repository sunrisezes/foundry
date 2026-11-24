import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const claimSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
  match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },
  claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerOrFinder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  verificationAnswer: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending', index: true },
  handoverCode: { type: String, default: null, select: false },
  messages: { type: [messageSchema], default: [] }
}, { timestamps: { createdAt: true, updatedAt: true } });

export default mongoose.model('Claim', claimSchema);
