const versionEl = document.getElementById('about-version')

if (versionEl && window.api?.getAppVersion) {
  window.api
    .getAppVersion()
    .then((v) => {
      versionEl.textContent = v
    })
    .catch(() => {
      versionEl.textContent = '—'
    })
}
