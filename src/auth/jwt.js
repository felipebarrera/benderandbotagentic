import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import crypto from 'crypto';

export const generateAccessToken = (payload) => {
    return jwt.sign(payload, config.api.jwtSecret, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload) => {
    const tokenId = crypto.randomBytes(8).toString('hex');
    return {
        token: jwt.sign({ ...payload, tokenId }, config.api.jwtRefreshSecret, { expiresIn: '7d' }),
        tokenId
    };
};

export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, config.api.jwtSecret);
    } catch (err) {
        if (err.name === 'TokenExpiredError') throw new Error('Token expirado');
        throw new Error('Token inválido');
    }
};

export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, config.api.jwtRefreshSecret);
    } catch (err) {
        if (err.name === 'TokenExpiredError') throw new Error('Refresh token expirado');
        throw new Error('Refresh token inválido');
    }
};
