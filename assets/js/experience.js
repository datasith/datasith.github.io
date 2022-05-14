AOS.init();

//  Work experience cards

const experiencecards = document.querySelector(".experience-cards");
const exp = [
  {
    title: "Senior Data Scientist",
    cardImage: "assets/images/experience-page/wgt.jpg",
    place: "Walmart Global Tech",
    time: "(Feb 2022 - Mar 2022)",
    desp: `<li>Combined Neural Nets for Object Tracking with SLAM methods to build a store's planogram</li>
           <li>Architected End-to-End Machine Learning solutions spanning three product verticals</li>
           <li>Devised scaling strategies for deploying a CV-based Inventory Tracking System across 4700+ stores</li>`,
  },
  {
    title: "Deep Learning Researcher",
    cardImage: "assets/images/experience-page/sn8.jpg",
    place: "Walmart Store No 8 (Incubator)",
    time: "(Aug 2021 - Feb 2022)",
    desp: `<li>Implemented heuristic algorithms for determining On-Shelf Availability of retail products</li>
           <li>Trained CNN ensembles for Object Detection and Object Tracking in densely packed images</li>
           <li>Contributed to the *fastest* incubation project to graduate from Store No. 8 into Walmart Global Tech</li>`,
},
{
  title: "Founder",
  cardImage: "assets/images/experience-page/acrobotic.jpg",
  place: "ACROBOTIC",
  time: "(Jun 2013 - Jul 2021)",
  desp: `<li>Managed a technical apprenticeship program in partnership with two local colleges</li>
         <li>Launched and successfully delivered 3 hardware products on Kickstarter</li>
         <li>Created tutorials and demos on YouTube <a href="https://youtube.com/datasith">growing an audience</a> of 30k+ subscribers</li>`,
},
{
  title: "Machine Learning Engineer",
  cardImage: "assets/images/experience-page/iorodeo.jpg",
  place: "IO Rodeo",
  time: "(Jun 2012 - May 2013)",
  desp: `<li>Manufactured custom lab instrumentation for behavioral studies of fruit flies</li>
         <li>Developed Control and Human-Machine interfaces for interactive lab instruments</li>
         <li>Designed custom PCBs and mechanical assemblies using ECAD/CAD software</li>`,
},
{
  title: "Research Assistant, Computer Vision",
  cardImage: "assets/images/experience-page/caltech.jpg",
  place: "California Institute of Technology",
  time: "(Sep 2009 - Aug 2012)",
  desp: `<li>Developed analysis pipelines for high-speed videography (post-processing and real-time)</li>
         <li>Applied Unsupervised Learning algorithms to track insect wing and body 3D kinematics</li>
         <li>Applied Control and Dynamical Systems theory to study sensory-motor transformations</li>`,
},
{
  title: "Professional Soccer Player",
  cardImage: "assets/images/experience-page/italchacao.jpg",
  place: "Deportivo Italchacao",
  time: "(Sep 2009 - Aug 2012)",
  desp: `<li>Played as Center Forward in the U17 category with some appearances for the first team</li>`,
},
];

const showCards2 = () => {
  let output = "";
  exp.forEach(
    ({ title, cardImage, place, time, desp }) =>
      (output += `        
    <div class="col gaap" data-aos="fade-up" data-aos-easing="linear" data-aos-delay="100" data-aos-duration="400"> 
      <div class="card card1">
        <img src="${cardImage}" class="featured-image"/>
        <article class="card-body">
          <header>
            <div class="title">
              <h3>${title}</h3>
            </div>
            <p class="meta">
              <span class="pre-heading">${place}</span><br>
              <span class="author">${time}</span>
            </p>
            <ol>
              ${desp}
            </ol>
          </header>
        </article>
      </div>
    </div>
      `)
  );
  experiencecards.innerHTML = output;
};
document.addEventListener("DOMContentLoaded", showCards2);

// Volunteership Cards

const volunteership = document.querySelector(".volunteership");
const volunteershipcards = [
  {
    title: "Girls Who Code @San Marino HS",
    cardImage: "assets/images/experience-page/gwc.jpg",
    description:
      `"As a co-instructor I was responsible for creating and imparting the curriculum,
        which I based around Physical Computing devices such as Arduino dev boards and Raspberry Pi SBCs."`,
  },
  {
    title: "DIY Girls",
    cardImage: "assets/images/experience-page/diygirls.jpg",
    description:
      `"As a volunteer, I have helped with event logistics and collaborated with the founder, 
        Luz Rivas, in the creation of curricula around DIY Electronic projects."`,
  },
];

const showCards = () => {
  let output = "";
  volunteershipcards.forEach(
    ({ title, cardImage, description }) =>
      (output += `        
      <div class="card volunteerCard" data-aos="fade-down" data-aos-easing="linear" data-aos-delay="100" data-aos-duration="600" style="height: 550px;width:400px">
      
      <img src="${cardImage}" height="250" width="65" class="card-img" style="border-radius:10px">
      <div class="content">
          <h2 class="volunteerTitle">${title}</h2><br>
          <p class="copy">${description}</p></div>
      
      </div>
      `)
  );
  volunteership.innerHTML = output;
};
document.addEventListener("DOMContentLoaded", showCards);

// Open Source Section

const hackathonsection = document.querySelector(".hackathon-section");
const mentor = [
  {
    title: "ESP8266 Tips & Tricks",
    subtitle: "ACROBOTIC",
    image: "assets/images/experience-page/esp8266.jpg",
    description: "Codebase and accompanying YouTube series with step-by-step guides for practical uses of the ESP8266 SoC.",
    link: "https://github.com/datasith/Ai_Tips_ESP8266",
  },
];

const showCards3 = () => {
  let output = "";
  mentor.forEach(
    ({ title, image, subtitle, description, link }) =>
      (output += `  
      <div class="blog-slider__item swiper-slide">
        <div class="blog-slider__img">
            <img src="${image}" alt="">
        </div>
        <div class="blog-slider__content">
          <div class="blog-slider__title">${title}</div>
          <span class="blog-slider__code">${subtitle}</span>
          <div class="blog-slider__text">${description}</div>
          <a href="${link}" class="blog-slider__button">Read More</a>   
        </div>
      </div>
      `)
  );
  hackathonsection.innerHTML = output;
};
document.addEventListener("DOMContentLoaded", showCards3);
