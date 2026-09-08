import fs from 'fs';

const proxyPath = 'server/_core/storageProxy.ts';
let proxyContent = fs.readFileSync(proxyPath, 'utf8');

const validationOld = `      const category = req.headers["x-file-category"] as any;`;
const validationNew = `      const rawCategory = req.headers["x-file-category"] as string;
      const validCategories = new Set(["import", "report", "backup", "attachment"]);
      if (!validCategories.has(rawCategory)) {
        res.status(400).send("تصنيف الملف غير صالح");
        return;
      }
      const category = rawCategory as "import" | "report" | "backup" | "attachment";`;

proxyContent = proxyContent.replace(validationOld, validationNew);
fs.writeFileSync(proxyPath, proxyContent);
