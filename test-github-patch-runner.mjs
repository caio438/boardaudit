import assert from 'node:assert/strict';
import fs from 'node:fs';
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

assert.throws(() => extractPatchFromBody(valid + '\n' + valid), /exatamente um par/);

for (const protectedPath of [
  '.github/workflows/evil.yml',
  '.github/actions/evil/action.yml',
  '.gitmodules',
  '.env',
  'config/credentials.json',
  'keys/service-account.pem',
  'scripts/extract-issue-patch.mjs',
  'test-github-patch-runner.mjs'
]) {
  assert.throws(
    () => extractPatchFromBody(wrap(`
diff --git a/${protectedPath} b/${protectedPath}
new file mode 100644
--- /dev/null
+++ b/${protectedPath}
@@ -0,0 +1 @@
+blocked
`)),
    /Arquivo protegido/,
    protectedPath
  );
}

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

assert.throws(() => extractPatchFromBody('sem marcadores'), /PATCH_START/);

const workflow = fs.readFileSync('.github/workflows/apply-chatgpt-patch.yml', 'utf8');
assert.match(workflow, /github\.event\.comment\.body == '\/apply-patch'/);
assert.match(workflow, /github\.event\.comment\.user\.login == 'caio438'/);
assert.match(workflow, /github\.event\.issue\.user\.login == 'caio438'/);
assert.match(workflow, /github\.event\.issue\.pull_request == null/);
assert.match(workflow, /persist-credentials: false/);
assert.match(workflow, /git apply --check/);
assert.match(workflow, /npm ci/);
assert.match(workflow, /npm test/);
assert.match(workflow, /--draft/);
assert.doesNotMatch(workflow, /gh pr merge|\/release-boardaudit|clasp deploy|clasp push/);

console.log('GitHub patch runner validado: autor restrito, patch isolado, paths protegidos, testes e PR draft sem merge/deploy.');
