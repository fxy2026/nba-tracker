"""Small offline safety and geometry tests for the local-only importer."""
import hashlib
import io
import lzma
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import import_early_archives as importer


class ImportSafetyTests(unittest.TestCase):
    def archive(self, name='shotdetail_1996.csv', kind=tarfile.REGTYPE, content=b'a,b\n1,2\n'):
        target = io.BytesIO()
        with tarfile.open(fileobj=target, mode='w') as archive:
            member = tarfile.TarInfo(name)
            member.type = kind
            member.size = len(content) if kind == tarfile.REGTYPE else 0
            if kind == tarfile.SYMTYPE:
                member.linkname = '/etc/passwd'
            archive.addfile(member, io.BytesIO(content) if kind == tarfile.REGTYPE else None)
        return lzma.compress(target.getvalue())

    def read(self, data, size_delta=0, digest=None):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'shotdetail_1996.tar.xz'
            path.write_bytes(data)
            expected = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
            return importer.read_archive(path, {'size': len(data)+size_delta, 'sha': digest or expected})

    def test_regular_csv_only(self):
        _, raw, member = self.read(self.archive())
        self.assertEqual(raw, b'a,b\n1,2\n')
        self.assertEqual(member['name'], 'shotdetail_1996.csv')

    def test_rejects_wrong_source_size_and_blob(self):
        for kw in [{'size_delta': 1}, {'digest': '0'*40}]:
            with self.subTest(kw=kw), self.assertRaises(AssertionError):
                self.read(self.archive(), **kw)

    def test_rejects_unsafe_or_unexpected_member(self):
        for name, kind in [('../shotdetail_1996.csv', tarfile.REGTYPE), ('/shotdetail_1996.csv', tarfile.REGTYPE), ('shotdetail_1996.csv', tarfile.SYMTYPE), ('other.csv', tarfile.REGTYPE)]:
            with self.subTest(name=name, kind=kind), self.assertRaises(AssertionError):
                self.read(self.archive(name, kind))

    def test_rejects_concatenated_or_truncated_xz(self):
        data = self.archive()
        for value in [data+data, data[:-20]]:
            with self.assertRaises((AssertionError, lzma.LZMAError)):
                self.read(value)

    def test_rejects_expansion_over_bound(self):
        with patch.object(importer, 'MAX_EXPANDED', 1024), self.assertRaises((AssertionError, lzma.LZMAError)):
            self.read(self.archive(content=b'x'*2048))

    def test_literal_three_point_zero_quarantine_only(self):
        row = {'LOC_X': '0', 'LOC_Y': '0'}
        self.assertEqual(importer.coordinate(row, True), ('coordinate-shot-type-conflict', (0., 0.)))
        self.assertEqual(importer.coordinate(row, False), (None, (0., 0.)))

    def test_frame_boundaries_and_no_inferred_point_value(self):
        for x, y, expected in [(-250, -52.5, None), (250, 417.5, None), (0, 417.5001, 'backcourt'), (0, 887.5, 'backcourt'), (0, 887.6, 'out-of-court'), (251, 200, 'out-of-court')]:
            for three in (True, False):
                self.assertEqual(importer.coordinate({'LOC_X': str(x), 'LOC_Y': str(y)}, three)[0], expected)

    def test_bad_coordinates_are_explicit(self):
        for x, expected in [('', 'missing-coordinate'), ('NaN', 'nonfinite-coordinate'), ('Infinity', 'nonfinite-coordinate'), ('bad', 'invalid-coordinate')]:
            self.assertEqual(importer.coordinate({'LOC_X': x, 'LOC_Y': '0'}, False)[0], expected)

    def test_legacy_compatible_boundary_evaluation(self):
        # Independent raw-CSV replay matches the frozen 2005 pack at both resolutions.
        self.assertEqual(importer.bin_for(0, 106, 25), (-1, 3))

    def test_hex_round_trip_centers(self):
        import math
        for radius in (25, 40):
            for q in range(-7, 8):
                for r in range(-2, 12):
                    x, y = radius*math.sqrt(3)*(q+r/2), radius*1.5*r
                    self.assertEqual(importer.bin_for(x, y, radius), (q, r))


if __name__ == '__main__':
    unittest.main()
