import * as net from 'net';
import * as tls from 'tls';
import * as crypto from 'crypto';

function encodeLength(len: number): Buffer {
    if (len < 0x80) {
        return Buffer.from([len]);
    } else if (len < 0x4000) {
        return Buffer.from([len >> 8 | 0x80, len & 0xFF]);
    } else if (len < 0x200000) {
        return Buffer.from([len >> 16 | 0xC0, (len >> 8) & 0xFF, len & 0xFF]);
    } else if (len < 0x10000000) {
        return Buffer.from([len >> 24 | 0xE0, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF]);
    } else {
        return Buffer.from([0xF0, len >> 24, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF]);
    }
}

function decodeLength(data: Buffer, offset: number): { len: number; bytesRead: number } {
    if (data.length <= offset) return { len: 0, bytesRead: 0 };

    let b = data[offset];
    if ((b & 0x80) === 0x00) {
        return { len: b, bytesRead: 1 };
    } else if ((b & 0xC0) === 0x80) {
        if (data.length <= offset + 1) return { len: 0, bytesRead: 0 };
        return { len: ((b & ~0x80) << 8) | data[offset + 1], bytesRead: 2 };
    } else if ((b & 0xE0) === 0xC0) {
        if (data.length <= offset + 2) return { len: 0, bytesRead: 0 };
        return { len: ((b & ~0xC0) << 16) | (data[offset + 1] << 8) | data[offset + 2], bytesRead: 3 };
    } else if ((b & 0xF0) === 0xE0) {
        if (data.length <= offset + 3) return { len: 0, bytesRead: 0 };
        return { len: ((b & ~0xE0) << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3], bytesRead: 4 };
    } else if ((b & 0xF8) === 0xF0) {
        if (data.length <= offset + 4) return { len: 0, bytesRead: 0 };
        return { len: (data[offset + 1] << 24) | (data[offset + 2] << 16) | (data[offset + 3] << 8) | data[offset + 4], bytesRead: 5 };
    }
    return { len: 0, bytesRead: 0 };
}

export class MikrotikApiSslClient {
    private socket: tls.TLSSocket | null = null;
    private host: string;
    private port: number;
    private connectTimeout: number;

    constructor(host: string, port = 8729, connectTimeout = 8000) {
        this.host = host;
        this.port = port;
        this.connectTimeout = connectTimeout;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.socket) this.socket.destroy();
                reject(new Error(`Timeout connecting to ${this.host}:${this.port}`));
            }, this.connectTimeout);

            this.socket = tls.connect({
                host: this.host,
                port: this.port,
                rejectUnauthorized: false
            }, () => {
                clearTimeout(timeout);
                resolve();
            });

            this.socket.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.end();
            this.socket = null;
        }
    }

    private readWord(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.socket) return reject(new Error("Not connected"));

            const readLen = () => {
                const lenBuf = this.socket!.read(1);
                if (!lenBuf) {
                    this.socket!.once('readable', readLen);
                    return;
                }
                let b = lenBuf[0];
                let lenBytes = 1;
                if ((b & 0x80) === 0x00) lenBytes = 1;
                else if ((b & 0xC0) === 0x80) lenBytes = 2;
                else if ((b & 0xE0) === 0xC0) lenBytes = 3;
                else if ((b & 0xF0) === 0xE0) lenBytes = 4;
                else if ((b & 0xF8) === 0xF0) lenBytes = 5;

                if (lenBytes > 1) {
                    const restLen = () => {
                        const rest = this.socket!.read(lenBytes - 1);
                        if (!rest) {
                            this.socket!.once('readable', restLen);
                            return;
                        }
                        const fullLenBuf = Buffer.concat([lenBuf, rest]);
                        const decoded = decodeLength(fullLenBuf, 0);
                        readData(decoded.len);
                    };
                    restLen();
                } else {
                    const decoded = decodeLength(lenBuf, 0);
                    readData(decoded.len);
                }
            };

            const readData = (len: number) => {
                if (len === 0) {
                    return resolve('');
                }
                const readChunk = () => {
                    const chunk = this.socket!.read(len);
                    if (!chunk) {
                        this.socket!.once('readable', readChunk);
                        return;
                    }
                    resolve(chunk.toString('utf-8'));
                };
                readChunk();
            };

            readLen();
        });
    }

    private async readSentence(): Promise<string[]> {
        const sentence: string[] = [];
        while (true) {
            const word = await this.readWord();
            if (word === '') break;
            sentence.push(word);
        }
        return sentence;
    }

    private writeWord(word: string): void {
        if (!this.socket) throw new Error("Not connected");
        const buf = Buffer.from(word, 'utf-8');
        const lenBuf = encodeLength(buf.length);
        this.socket.write(lenBuf);
        this.socket.write(buf);
    }

    private writeSentence(sentence: string[]): void {
        for (const word of sentence) {
            this.writeWord(word);
        }
        this.writeWord('');
    }

    async execute(command: string, args: Record<string, string> = {}): Promise<Array<Record<string, string>>> {
        const sentence = [command];
        for (const [key, value] of Object.entries(args)) {
            sentence.push(`=${key}=${value}`);
        }

        return new Promise((resolve, reject) => {
            this.writeSentence(sentence);

            const results: Array<Record<string, string>> = [];

            const processNext = async () => {
                try {
                    const reply = await this.readSentence();
                    if (reply.length === 0) return;

                    const replyType = reply[0];
                    if (replyType === '!done') {
                        // Check if !done has a =ret= value
                        const parsed: Record<string, string> = {};
                        for (let i = 1; i < reply.length; i++) {
                            const word = reply[i];
                            if (word.startsWith('=')) {
                                const eqIndex = word.indexOf('=', 1);
                                if (eqIndex !== -1) {
                                    const key = word.substring(1, eqIndex);
                                    const value = word.substring(eqIndex + 1);
                                    parsed[key] = value;
                                }
                            }
                        }
                        if (Object.keys(parsed).length > 0 && results.length === 0) {
                            results.push(parsed);
                        }
                        resolve(results);
                    } else if (replyType === '!re') {
                        const parsed: Record<string, string> = {};
                        for (let i = 1; i < reply.length; i++) {
                            const word = reply[i];
                            if (word.startsWith('=')) {
                                const eqIndex = word.indexOf('=', 1);
                                if (eqIndex !== -1) {
                                    const key = word.substring(1, eqIndex);
                                    const value = word.substring(eqIndex + 1);
                                    parsed[key] = value;
                                }
                            }
                        }
                        results.push(parsed);
                        processNext();
                    } else if (replyType === '!trap') {
                        const parsed: Record<string, string> = {};
                        for (let i = 1; i < reply.length; i++) {
                            const word = reply[i];
                            if (word.startsWith('=')) {
                                const eqIndex = word.indexOf('=', 1);
                                if (eqIndex !== -1) {
                                    const key = word.substring(1, eqIndex);
                                    const value = word.substring(eqIndex + 1);
                                    parsed[key] = value;
                                }
                            }
                        }
                        reject(new Error(parsed.message || "Unknown error"));
                    } else if (replyType === '!fatal') {
                         reject(new Error("Fatal error"));
                    } else {
                        processNext();
                    }
                } catch (e) {
                    reject(e);
                }
            };

            processNext();
        });
    }

    async login(username: string, password: string): Promise<void> {
        // RouterOS 6 uses challenge-response authentication.
        // First we send /login
        let challenge = "";
        try {
             const res = await this.execute('/login');
             if (res.length > 0 && res[0].ret) {
                 challenge = res[0].ret;
             }
        } catch (e: any) {
             throw new Error("Failed to initialize login: " + e.message);
        }

        if (!challenge) {
            // RouterOS 7 plain login
            try {
                await this.execute('/login', { name: username, password: password });
                return;
            } catch (e: any) {
                throw new Error("Plain login failed: " + e.message);
            }
        }

        // RouterOS 6 challenge-response
        const md5 = crypto.createHash('md5');
        md5.update(Buffer.from([0])); // null byte
        md5.update(password);
        md5.update(Buffer.from(challenge, 'hex'));

        const response = `00${md5.digest('hex')}`;

        try {
            await this.execute('/login', { name: username, response });
        } catch (e: any) {
            throw new Error("Login failed (401): " + e.message);
        }
    }
}
