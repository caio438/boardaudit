import assert from 'node:assert/strict';
import { extractPatchFromBody } from './scripts/extract-issue-patch.mjs';

const wrap = patch => `<!-- PATCH_START -->
\`\`\`diff
${patch.trim()}
\`\`\`
<!-- PATCH_END -->`;

const valid = wrap(`
diff --git a/Index.html b/Index.html
index 1111111..2222222 100644
--- a/Index.html
+++ b/Index.html
@@ -1 +1 @@
-old
+new
`);

const parsed = extractPatchFromBody(valid);
assert.equal(parsed.paths.includes('Index.html'), true);
assert.match(parsed.patch, /^diff --git /);

assert.throws(
  () => extractPatchFromBody(valid + '\n' + valid),
  /exatamente um par/
);

assert.throws(
  () => extractPatchFromBody(wrap(`
diff --git a/.github/workflows/evil.yml b/.github/workflows/evil.yml
new file mode 100644
--- /dev/null
+++ b/.github/workflows/evil.yml
@@ -0,0 +1 @@
+name: evil
`)),
  /Arquivo protegido/
);

assert.throws(
  () => extractPatchFromBody(wrap(`
diff --git a/../outside.txt b/../outside.txt
new file mode 100644
--- /dev/null
+++ b/../outside.txt
@@ -0,0 +1 @@
+x
`)),
  /Path traversal/
);

assert.throws(
  () => extractPatchFromBody('sem marcadores'),
  /PATCH_START/
);

console.log('GitHub patch runner validado: extração única, paths protegidos e path traversal bloqueados.');
