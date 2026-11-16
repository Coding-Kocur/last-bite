/* Movement on the page: titles and blocks that appear once when they are
   scrolled to, numbers that count up, and the header.
   Phones and tablets (up to 1024px) and desktops get separate behaviour. */

(function () {
  "use strict";

  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var top = document.querySelector(".top");
  var menu = document.getElementById("menu");
  var heroPhoto = document.querySelector(".hero .frame img");

  function isDesktop() {
    return window.innerWidth > 1024;
  }

  function countUp(node) {
    var parts = node.textContent.trim().match(/^(\d+)(.*)$/);
    if (!parts) return;
    var target = Number(parts[1]);
    var rest = parts[2];
    var began = null;

    function frame(now) {
      if (began === null) began = now;
      var done = Math.min((now - began) / 1200, 1);
      node.textContent = Math.round(target * (1 - Math.pow(1 - done, 3))) + rest;
      if (done < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function show(node) {
    if (node.classList.contains("is-in")) return;
    node.classList.add("is-in");
    if (!still && node.hasAttribute("data-count")) countUp(node);
  }

  // Each block is shown once and then left alone, so it stays when the
  // visitor scrolls back up.
  var watcher = null;
  if (!still && "IntersectionObserver" in window) {
    watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        watcher.unobserve(entry.target);
        show(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
  }

  function watch(root) {
    root.querySelectorAll(".reveal, .stagger, .lines, [data-count]").forEach(function (node) {
      if (node.classList.contains("is-in")) return;
      if (watcher) watcher.observe(node);
      else show(node);
    });
  }

  // The last blocks of a short page never cross the trigger line.
  function showRest() {
    document.querySelectorAll(".reveal, .stagger, .lines, [data-count]").forEach(function (node) {
      if (node.classList.contains("is-in")) return;
      if (watcher) watcher.unobserve(node);
      show(node);
    });
  }

  /* desktop: the hero photo drifts a little slower than the page */
  function drift() {
    if (!heroPhoto || still) return;
    var box = heroPhoto.parentNode.getBoundingClientRect();
    if (box.bottom < 0) return;
    var offset = (box.top + box.height / 2) / window.innerHeight - 0.5;
    heroPhoto.style.translate = "0 " + (-offset * box.height * 0.06).toFixed(1) + "px";
  }

  /* phone and tablet: the header steps aside on the way down the page */
  var lastY = window.scrollY;
  function tuckHeader(y) {
    var open = menu && (menu.classList.contains("show") || menu.classList.contains("collapsing"));
    if (open || Math.abs(y - lastY) < 6) return;
    top.classList.toggle("away", y > lastY && y > 120);
    lastY = y;
  }

  var queued = false;
  function onScroll() {
    queued = false;
    var y = window.scrollY;
    top.classList.toggle("scrolled", y > 8);

    if (isDesktop()) {
      top.classList.remove("away");
      lastY = y;
      drift();
    } else {
      if (heroPhoto) heroPhoto.style.translate = "";
      tuckHeader(y);
    }

    if (window.innerHeight + y >= document.documentElement.scrollHeight - 2) showRest();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(onScroll);
  }

  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  top.addEventListener("focusin", function () {
    top.classList.remove("away");
  });

  // phone and tablet: a tap outside the open menu closes it
  document.addEventListener("click", function (e) {
    if (isDesktop() || !menu || !menu.classList.contains("show") || top.contains(e.target)) return;
    bootstrap.Collapse.getOrCreateInstance(menu).hide();
  });

  window.lbWatch = watch;
  watch(document);
  onScroll();
  window.addEventListener("load", queue);
})();
