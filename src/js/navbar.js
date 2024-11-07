import { Carousel } from "flowbite";

export function setupNavbarCarousel() {
  // Select the buttons which control the carousel
  const btnGeneration = document.getElementById("btn-generation");
  const btnMasking = document.getElementById("btn-masking");
  const btnErosion = document.getElementById("btn-erosion");

  // Select the carousel element
  const carouselElement = document.getElementById("controls-carousel");

  // Define the carousel items based on the position and the element ID
  const items = [
    { position: 0, el: document.getElementById("carousel-item-0") },
    { position: 1, el: document.getElementById("carousel-item-1") },
    { position: 2, el: document.getElementById("carousel-item-2") },
  ];

  // console.log("Setting up carousel with items:", items);

  // Create the carousel object using Flowbite's Carousel class
  const carousel = new Carousel(carouselElement, items, {
    defaultPosition: 0, // Optionally set the default active slide
    onChange: (position) => {
      // console.log(`Carousel changed to position: ${position}`);
    },
  });

  // Add event listeners for each button to control the carousel
  btnGeneration.addEventListener("click", () => {
    carousel.slideTo(0);
  });

  btnMasking.addEventListener("click", () => {
    carousel.slideTo(1);
  });

  btnErosion.addEventListener("click", () => {
    carousel.slideTo(2);
  });
}

export function navbarFormating() {

  const inactiveIconClasses =
    "transition ease-in-out group-hover:-translate-y-1 group-hover:scale-110 text-battleship_gray group-hover:text-white text-shadow-none";
  const activeIconClasses = "-translate-y-1 scale-110 text-gold_metallic text-shadow-sm";

  const inactiveTextClasses =
    "transition ease-in-out group-hover:-translate-y-1 group-hover:scale-110 text-battleship_gray group-hover:text-white";
  const activeTextClasses =
    "-translate-y-1 scale-110 text-gold_metallic";

  const buttons = [
    {
      button: document.getElementById("btn-generation"),
      icon: document.getElementById("icon-generation"),
      text: document.getElementById("txt-generation"),
    },
    {
      button: document.getElementById("btn-masking"),
      icon: document.getElementById("icon-masking"),
      text: document.getElementById("txt-masking"),
    },
    {
      button: document.getElementById("btn-erosion"),
      icon: document.getElementById("icon-erosion"),
      text: document.getElementById("txt-erosion"),
    },
  ];

  // Function to update button classes based on the active position
  function updateButtonClasses(activePos) {
    buttons.forEach((btn, index) => {
      if (index === activePos) {
        // Active state
        btn.icon.classList.add(...activeIconClasses.split(" "));
        btn.icon.classList.remove(...inactiveIconClasses.split(" "));
        btn.text.classList.add(...activeTextClasses.split(" "));
        btn.text.classList.remove(...inactiveTextClasses.split(" "));
      } else {
        // Inactive state
        btn.icon.classList.add(...inactiveIconClasses.split(" "));
        btn.icon.classList.remove(...activeIconClasses.split(" "));
         btn.text.classList.add(...inactiveTextClasses.split(" "));
        btn.text.classList.remove(...activeTextClasses.split(" "));
      }
    });
  }

  // Initial formatting based on the default active position (0)
  updateButtonClasses(0);

  // Listen for button changes and update the formatting
    buttons.forEach((btn, index) => {
        btn.button.addEventListener("click", () => {
        updateButtonClasses(index);
        });
    });

}
