const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findOne, insert } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });

    const existing = await findOne('app_users', { email });
    if (existing) return res.status(409).json({ error: 'Email já cadastrado' });

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuid();
    await insert('app_users', { id, name, email, password_hash });

    const user = await findOne('app_users', { id });
    const { password_hash: _, ...safeUser } = user;
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    const user = await findOne('app_users', { email });
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

router.put('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token obrigatório' });
    const token = authHeader.replace('Bearer ', '');
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Token inválido' }); }

    const { name, role } = req.body;
    const user = await findOne('app_users', { id: payload.userId });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const { update } = require('../db');
    const updated = await update('app_users', { id: payload.userId }, {
      name: name ?? user.name,
      role: role ?? user.role,
    });
    const { password_hash, ...safeUser } = (updated || user);
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
