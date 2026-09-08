import fs from 'fs';

const proxyPath = 'server/_core/storageProxy.ts';
let proxyContent = fs.readFileSync(proxyPath, 'utf8');

proxyContent = proxyContent.replace(`import { crypto } from "crypto";`, `import * as crypto from "crypto";`);

fs.writeFileSync(proxyPath, proxyContent);
