const heading = document.querySelector(".h1");
const sub_title = document.querySelector(".h3");
const circle = document.querySelector(".circle");
const nav = document.querySelector(".nav");
gsap.from(heading, { y: 300, duration: 2 });
gsap.from(sub_title, { y: 200, duration: 2, delay: 1.5 });

gsap.from(circle, {
  opacity: 0,
  rotate: -90,
  duration: 5,
});
gsap.from(nav, { y: -150, duration: 1, delay: 1.5 });
