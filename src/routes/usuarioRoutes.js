const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const router = express.Router();

function isAdmin(req) {
    return req.usuario && req.usuario.perfil === 'administrador';
}

router.get('/', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ mensagem: 'Acesso negado.' });
    try {
        const usuarios = await db.prepare(`SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY nome`).all();
        return res.json(usuarios);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ mensagem: 'Não foi possível listar.' });
    }
});

router.post('/', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ mensagem: 'Acesso negado.' });
    try {
        const { nome, email, senha, perfil } = req.body;
        if (!nome ||!email ||!senha) return res.status(400).json({ mensagem: 'Nome, e-mail e senha são obrigatórios.' });
        const emailNormalizado = email.trim().toLowerCase();
        const existe = await db.prepare('SELECT id FROM usuarios WHERE email =?').get(emailNormalizado);
        if (existe) return res.status(409).json({ mensagem: 'Já existe um usuário com este e-mail.' });
        const hash = bcrypt.hashSync(senha, 10);
        const perfilN = perfil && perfil.trim().toLowerCase() === 'administrador'? 'administrador' : 'usuario';
        const r = await db.prepare(`INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,?)`).run(nome.trim(), emailNormalizado, hash, perfilN);
        const novo = await db.prepare(`SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios WHERE id =?`).get(r.lastInsertRowid);
        return res.status(201).json({ mensagem: 'Usuário criado.', usuario: novo });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ mensagem: 'Não foi possível criar.' });
    }
});

router.patch('/:id', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ mensagem: 'Acesso negado.' });
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ mensagem: 'ID inválido.' });
        const atual = await db.prepare('SELECT id, email FROM usuarios WHERE id =?').get(id);
        if (!atual) return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
        const { nome, email, perfil, ativo } = req.body;
        const updates = []; const params = [];
        if (nome) { updates.push('nome =?'); params.push(nome.trim()); }
        if (email) {
            const emailN = email.trim().toLowerCase();
            if (emailN!== atual.email) {
                const emUso = await db.prepare('SELECT id FROM usuarios WHERE email =? AND id!=?').get(emailN, id);
                if (emUso) return res.status(409).json({ mensagem: 'E-mail já em uso.' });
            }
            updates.push('email =?'); params.push(emailN);
        }
        if (perfil) { updates.push('perfil =?'); params.push(perfil.trim().toLowerCase() === 'administrador'? 'administrador' : 'usuario'); }
        if (typeof ativo === 'boolean') { updates.push('ativo =?'); params.push(ativo? 1 : 0); }
        if (updates.length === 0) return res.status(400).json({ mensagem: 'Nenhum dado para atualizar.' });
        params.push(id);
        await db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id =?`).run(...params);
        const atualizado = await db.prepare(`SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios WHERE id =?`).get(id);
        return res.json({ mensagem: 'Usuário atualizado.', usuario: atualizado });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ mensagem: 'Não foi possível atualizar.' });
    }
});

router.delete('/:id', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ mensagem: 'Acesso negado.' });
    try {
        const id = Number(req.params.id);
        if (req.usuario.id === id) return res.status(403).json({ mensagem: 'Você não pode deletar seu próprio usuário.' });
        const r = await db.prepare('DELETE FROM usuarios WHERE id =?').run(id);
        if (r.changes === 0) return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
        return res.json({ mensagem: 'Usuário deletado.' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ mensagem: 'Não foi possível deletar.' });
    }
});

module.exports = router;