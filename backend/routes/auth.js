const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });

    const existing = db.prepare('SELECT id FROM app_users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email já cadastrado' });

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuid();
    db.prepare('INSERT INTO app_users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(id, name, email, password_hash);

    const user = db.prepare('SELECT id, name, email, role, created_at FROM app_users WHERE id = ?').get(id);
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    const user = db.prepare('SELECT * FROM app_users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Email ou senha incorretos' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou senha incorretos' });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
