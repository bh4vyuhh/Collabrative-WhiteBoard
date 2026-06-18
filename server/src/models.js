const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({ x: Number, y: Number }, { _id: false });

const strokeSchema = new mongoose.Schema({
  id: String,
  tool: { type: String, enum: ['pen', 'eraser', 'line', 'rect', 'circle'] },
  color: String,
  width: Number,
  points: [pointSchema],
  userId: String,
  userName: String,
}, { _id: false });

const stickySchema = new mongoose.Schema({
  id: String,
  x: Number, y: Number,
  w: { type: Number, default: 200 },
  h: { type: Number, default: 150 },
  text: { type: String, default: '' },
  color: { type: String, default: '#fef3c7' },
  userId: String,
  userName: String,
}, { _id: false });

const boardSchema = new mongoose.Schema({
  roomId: { type: String, unique: true, index: true },
  strokes: [strokeSchema],
  stickies: [stickySchema],
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Board', boardSchema);
