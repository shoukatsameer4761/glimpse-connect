import unittest

from scan import inspect_file


class ScannerTests(unittest.TestCase):
    def test_payload_disguised_as_font(self):
        payload = b"const " + b"_0x" + b"a12345 = 1;"
        results = inspect_file("public/font.woff2", payload)
        self.assertIn("hex-obfuscated JavaScript", results)
        self.assertIn("font extension does not match file signature", results)

    def test_clean_postcss(self):
        self.assertEqual([], inspect_file("postcss.config.js", b"export default {plugins: {tailwindcss: {}, autoprefixer: {}}};"))

    def test_font_header(self):
        self.assertEqual([], inspect_file("font.woff2", b"wOF2\0\0\0\0"))

    def test_execution_tripwires(self):
        self.assertTrue(inspect_file("vite.config.ts", b"new " + b"Function('return 1')"))
        self.assertTrue(inspect_file("postcss.config.js", b"import { spawn } from 'child" + b"_process';"))

    def test_lockfile_rejects_arbitrary_host(self):
        self.assertTrue(inspect_file("package-lock.json", b'{"packages":{"node_modules/x":{"resolved":"https://example.com/x.tgz","integrity":"sha512-test"}}}'))

    def test_lifecycle(self):
        self.assertTrue(inspect_file("package.json", b'{"scripts":{"postinstall":"node payload.js"}}'))


if __name__ == "__main__":
    unittest.main()
