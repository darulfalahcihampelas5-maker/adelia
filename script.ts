import fs from 'fs';
import path from 'path';

function walk(dir: string) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      if (c.includes('#FFB0D4')) {
        fs.writeFileSync(p, c.replace(/#FFB0D4/ig, '#F06C84'));
        console.log('Updated ' + p);
      }
    }
  });
}

walk('./src');
