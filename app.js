(function () {
  'use strict';

  var CFG = window.PORTAL_CONFIG || {};
  var API = CFG.api || '';
  var EMAIL_RE = /^[\w\-.]+@([\w\-]+\.)+[\w\-]{2,}$/;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- date limits: not in the future, not more than 25 years ago ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var today = new Date();
  var MAX_DOB = iso(today);
  var MIN_DOB = iso(new Date(today.getFullYear() - 25, today.getMonth(), today.getDate()));
  $('dob').min = MIN_DOB;
  $('dob').max = MAX_DOB;

  function calcAge(dobIso) {
    var p = dobIso.split('-');
    var y = +p[0], m = +p[1], d = +p[2];
    var age = today.getFullYear() - y;
    if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
    return age < 0 ? 0 : age;
  }

  if (CFG.needsCode) { $('codeBox').classList.remove('hidden'); $('code').required = true; }

  /* ---------- helpers ---------- */
  function showError(msg) {
    var e = $('error');
    e.textContent = msg;
    e.classList.remove('hidden');
  }
  function clearError() { $('error').classList.add('hidden'); }

  function setStep(n) {
    [1, 2].forEach(function (i) { $('step' + i).classList.toggle('hidden', i !== n); });
    var items = document.querySelectorAll('#steps li');
    for (var i = 0; i < items.length; i++) {
      var num = i + 1;
      items[i].classList.toggle('is-current', num === n && n !== 2);
      items[i].classList.toggle('is-done', num < n || n === 2);
    }
    clearError();
    var h = $('h' + n);
    if (h) h.focus();
    window.scrollTo(0, 0);
  }

  function setBusy(btn, on) {
    if (on) {
      btn.disabled = true;
      btn.textContent = 'Please wait…';
    } else {
      btn.textContent = btn.getAttribute('data-label');
      btn.disabled = false;
    }
  }

  function call(payload) {
    if (!API || API.indexOf('YOUR-') !== -1) {
      return Promise.reject(new Error('This page is not set up yet. Ask the admin to finish the setup.'));
    }
    // text/plain keeps this a "simple" request, so the browser skips the extra preflight round trip.
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        try { return JSON.parse(t); }
        catch (e) { throw new Error('The server sent an unexpected reply. Please try again in a few minutes.'); }
      });
  }

  /* ---------- form behaviour ---------- */
  $('dob').addEventListener('change', function () {
    var v = $('dob').value;
    if (v && v >= MIN_DOB && v <= MAX_DOB) $('age').value = calcAge(v);
  });

  $('toggleAnswer').addEventListener('click', function () {
    var inp = $('securityAnswer');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    this.textContent = show ? 'Hide' : 'Show';
    this.setAttribute('aria-pressed', show ? 'true' : 'false');
  });

  function val(id) { return $(id).value.trim(); }

  function check() {
    if (!val('childName')) return ['childName', 'Child name is required.'];
    var dob = $('dob').value;
    if (!dob) return ['dob', "Please select the child's date of birth."];
    if (dob < MIN_DOB || dob > MAX_DOB) return ['dob', 'Please check the date of birth.'];
    var age = parseInt($('age').value, 10);
    if (isNaN(age) || age < 0 || age > 30) return ['age', 'Enter a valid age.'];
    if (!val('classroom')) return ['classroom', 'Classroom is required.'];
    if (!val('parentName')) return ['parentName', 'Parent name is required.'];
    if (val('parentPhone').replace(/\D/g, '').length < 10) return ['parentPhone', 'Enter a valid phone number.'];
    var em = val('parentEmail');
    if (em && !EMAIL_RE.test(em)) return ['parentEmail', 'Please enter a valid email address.'];
    if (!val('securityQuestion')) return ['securityQuestion', 'Security question is required.'];
    if (!$('securityAnswer').value.trim()) return ['securityAnswer', 'Security answer is required.'];
    if (CFG.needsCode && !val('code')) return ['code', 'Enter the registration code.'];
    return null;
  }

  $('form1').addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearError();

    var problem = check();
    if (problem) { showError(problem[1]); $(problem[0]).focus(); return; }

    var payload = {
      action: 'register',
      childName: val('childName'),
      dateOfBirth: $('dob').value,
      age: parseInt($('age').value, 10),
      classroom: val('classroom'),
      parentName: val('parentName'),
      parentPhone: val('parentPhone'),
      parentEmail: val('parentEmail'),
      securityQuestion: val('securityQuestion'),
      securityAnswer: $('securityAnswer').value.trim()
    };
    if (CFG.needsCode) payload.code = val('code');

    var btn = $('btn1');
    setBusy(btn, true);
    call(payload)
      .then(function (res) {
        if (!res.success) { showError(res.error || 'Failed to register child.'); return; }

        $('doneMsg').textContent = payload.childName.charAt(0).toUpperCase() +
          payload.childName.slice(1).toLowerCase() + ' has been registered. Keep this ID safe.';
        $('childId').textContent = res.childId || '';

        var wrap = $('qrWrap');
        wrap.textContent = '';
        if (res.qrCodeUrl && /^https:\/\//i.test(res.qrCodeUrl)) {
          var a = document.createElement('a');
          a.href = res.qrCodeUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = "Open your child's QR code";
          wrap.appendChild(a);
        }

        $('securityAnswer').value = '';
        setStep(2);
      })
      .catch(function (e) { showError(e.message || 'Network problem. Check your internet and try again.'); })
      .then(function () { setBusy(btn, false); });
  });

  /* ---------- register another child: keep parent details, clear child + security answer ---------- */
  $('another').addEventListener('click', function () {
    ['childName', 'dob', 'age', 'classroom', 'securityAnswer'].forEach(function (id) { $(id).value = ''; });
    $('securityAnswer').type = 'password';
    $('toggleAnswer').textContent = 'Show';
    setStep(1);
    $('childName').focus();
  });
})();