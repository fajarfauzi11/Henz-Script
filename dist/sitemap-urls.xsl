<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Sitemap — Henz MLBB</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;color:#222;margin:0;padding:40px 20px}
  .wrap{max-width:920px;margin:0 auto;background:#fff;border-radius:14px;padding:32px 36px;box-shadow:0 2px 14px rgba(0,0,0,.06);border:1px solid #ececec}
  .brand{font-size:12px;font-weight:700;letter-spacing:.06em;color:#e53232;text-transform:uppercase;margin:0 0 6px}
  h1{font-size:22px;margin:0 0 10px;color:#111}
  h1 span{color:#e53232}
  p{color:#666;font-size:14px;line-height:1.7;margin:0 0 4px}
  p a{color:#e53232;text-decoration:none}
  p a:hover{text-decoration:underline}
  .back{display:inline-block;margin-top:2px;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:22px;font-size:13.5px}
  th{text-align:left;padding:9px 12px;border-bottom:2px solid #e5e5e5;color:#111;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  td{padding:9px 12px;border-bottom:1px solid #f0f0f0;word-break:break-all}
  tr:hover td{background:#fafafa}
  a.loc{color:#18181b;text-decoration:none}
  a.loc:hover{color:#e53232;text-decoration:underline}
  td.meta{white-space:nowrap;color:#999;width:1%}
</style>
</head>
<body>
<div class="wrap">
  <p class="brand">Henz MLBB</p>
  <h1>XML <span>Sitemap</span></h1>
  <p>Berisi <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/> URL, dibuat otomatis sesuai standar <a href="https://www.sitemaps.org/" target="_blank">sitemaps.org</a>.</p>
  <p class="back"><a href="/sitemap_index.xml">&#8592; Kembali ke Sitemap Index</a></p>
  <table>
    <tr><th>URL</th><th>Freq</th><th>Prioritas</th><th>Terakhir Diubah</th></tr>
    <xsl:for-each select="sitemap:urlset/sitemap:url">
      <tr>
        <td><a class="loc" href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a></td>
        <td class="meta"><xsl:value-of select="sitemap:changefreq"/></td>
        <td class="meta"><xsl:value-of select="sitemap:priority"/></td>
        <td class="meta"><xsl:value-of select="sitemap:lastmod"/></td>
      </tr>
    </xsl:for-each>
  </table>
</div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
