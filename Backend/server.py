#!/usr/bin/python3
from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import time
import os
from eth_account import Account
from eth_account.messages import encode_typed_data
from eth_utils import to_checksum_address

app = Flask(__name__, static_folder='.', static_url_path='')

DB_NAME = "usuarios.db"

# ==========================================
# CONFIGURACIÓN EIP-712
# ==========================================
BACKEND_PRIVATE_KEY = "e688330ab040681333784099f4c27f3e8e6932b0bd99558fd6bcc1cdc5c1982d"
CHAIN_ID = 11155111  # Sepolia

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            correo TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    nombre = data.get('nombre')
    apellido = data.get('apellido')
    correo = data.get('correo')
    password = data.get('password')

    if not all([nombre, apellido, correo, password]):
        return jsonify({"success": False, "message": "Todos los campos son obligatorios."}), 400

    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO usuarios (nombre, apellido, correo, password) VALUES (?, ?, ?, ?)",
            (nombre, apellido, correo, password)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Usuario registrado exitosamente."})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "El correo electrónico ya está registrado."}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    correo = data.get('correo')
    password = data.get('password')

    if not all([correo, password]):
        return jsonify({"success": False, "message": "Correo y contraseña requeridos."}), 400

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT nombre, apellido FROM usuarios WHERE correo = ? AND password = ?", (correo, password))
    user = cursor.fetchone()
    conn.close()

    if user:
        return jsonify({"success": True, "message": f"Bienvenido {user[0]} {user[1]}", "nombre": user[0]})
    else:
        return jsonify({"success": False, "message": "Credenciales inválidas."}), 401

@app.route('/api/claim-signature', methods=['POST'])
def claim_signature():
    data = request.json
    user_address = data.get('userAddress')
    activity_id = data.get('activityId')
    
    if not user_address or activity_id is None:
        return jsonify({"success": False, "message": "Faltan parámetros (userAddress o activityId)."}), 400

    try:
        amount = 100 * 10**18  # 100 MXP
        deadline = int(time.time()) + 3600  # Válido por 1 hora

        eip712_data = {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"}
                ],
                "Claim": [
                    {"name": "user", "type": "address"},
                    {"name": "activityId", "type": "uint256"},
                    {"name": "amount", "type": "uint256"},
                    {"name": "deadline", "type": "uint256"}
                ]
            },
            "primaryType": "Claim",
            "domain": {
                "name": "MintXP",
                "version": "1",
                "chainId": CHAIN_ID,
                "verifyingContract": "0xdb90a4C8AC91941935980b7B7c230bE2e6d58426"
            },
            "message": {
                "user": to_checksum_address(user_address),
                "activityId": int(activity_id),
                "amount": int(amount),
                "deadline": int(deadline)
            }
        }

        encoded_data = encode_typed_data(full_message=eip712_data)
        signed_message = Account.sign_message(encoded_data, private_key=BACKEND_PRIVATE_KEY)
        signature = signed_message.signature.hex() 

        return jsonify({
            "success": True,
            "signature": signature,
            "amount": str(amount),
            "deadline": deadline
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    init_db()
    print("Servidor corriendo en http://127.0.0.1:5000")
    app.run(debug=True, port=5000)