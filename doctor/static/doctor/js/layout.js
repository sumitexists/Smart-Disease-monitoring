/**
 * layout.js  —  Sidebar toggle, active nav highlight
 * Smart Disease Monitor
 */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {

    // ── Sidebar toggle ─────────────────────────────────────────
    const wrapper = document.getElementById("app-wrapper");
    const toggleBtn = document.getElementById("sidebar-toggle");
    const COLLAPSED_KEY = "sdm_sidebar_collapsed";

    function applyCollapsed(collapsed) {
      if (collapsed) {
        wrapper.classList.add("sidebar-collapsed");
        wrapper.classList.remove("sidebar-open");
      } else {
        wrapper.classList.remove("sidebar-collapsed");
      }
    }

    // Restore preference
    const savedState = localStorage.getItem(COLLAPSED_KEY) === "true";
    applyCollapsed(savedState);

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        // Mobile: toggle sidebar-open; Desktop: toggle sidebar-collapsed
        if (window.innerWidth <= 768) {
          wrapper.classList.toggle("sidebar-open");
        } else {
          const isCollapsed = wrapper.classList.contains("sidebar-collapsed");
          applyCollapsed(!isCollapsed);
          localStorage.setItem(COLLAPSED_KEY, String(!isCollapsed));
        }
      });
    }

    // Close sidebar on mobile when clicking outside
    document.addEventListener("click", function (e) {
      if (window.innerWidth > 768) return;
      if (!wrapper) return;
      const sidebar = document.querySelector(".sidebar");
      if (sidebar && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        wrapper.classList.remove("sidebar-open");
      }
    });

    // ── Active nav item ─────────────────────────────────────────
    const currentPath = window.location.pathname;
    document.querySelectorAll(".nav-item[data-path]").forEach(function (item) {
      const path = item.getAttribute("data-path");
      if (!path) {
        return;
      }

      if (path === "/") {
        if (currentPath === "/") {
          item.classList.add("active");
        }
        return;
      }

      if (currentPath.startsWith(path)) {
        item.classList.add("active");
      }
    });

    // ── Auto-dismiss flash messages ─────────────────────────────
    document.querySelectorAll(".alert-strip").forEach(function (el) {
      setTimeout(function () {
        el.style.transition = "opacity 0.5s ease, max-height 0.5s ease";
        el.style.opacity = "0";
        el.style.maxHeight = "0";
        el.style.overflow = "hidden";
        el.style.padding = "0";
        el.style.margin = "0";
      }, 4000);
    });

  });

})();
