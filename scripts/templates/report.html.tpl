<!DOCTYPE html>
<html lang="en">

<head>
    <!-- Global site tag (gtag.js) - Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=UA-40012093-30"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'UA-40012093-30');
</script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="More and more institutions have come to recognize that in the 21st century their in-house capacity and knowledge are too limited when compared to the speed, scale and complexity of many public problems. Instead, they look to networks of people inside and outside of government to make decisions and take action more effectively and, because those decisions involve the community, more legitimately. We studied examples from around the world in order to identify what is involved in using and institutionalising this “collective intelligence” successfully." />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Collective Intelligence Case Studies" />
    <meta property="og:description" content="More and more institutions have come to recognize that in the 21st century their in-house capacity and knowledge are too limited when compared to the speed, scale and complexity of many public problems. Instead, they look to networks of people inside and outside of government to make decisions and take action more effectively and, because those decisions involve the community, more legitimately. We studied examples from around the world in order to identify what is involved in using and institutionalising this “collective intelligence” successfully." />
    <meta property="og:image" content="case/images/ss.png" />
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@thegovlab">
    <meta name="twitter:title" content="Collective Intelligence Case Studies">
<meta name="twitter:description" content="More and more institutions have come to recognize that in the 21st century their in-house capacity and knowledge are too limited when compared to the speed, scale and complexity of many public problems. Instead, they look to networks of people inside and outside of government to make decisions and take action more effectively and, because those decisions involve the community, more legitimately. We studied examples from around the world in order to identify what is involved in using and institutionalising this “collective intelligence” successfully.">
<meta name="twitter:image" content="case/images/ss.png" />


    <title>Collective Intelligence Case Studies</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://use.typekit.net/kwv5eho.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
    <script src="https://unpkg.com/@directus/sdk-js@5.3.4/dist/directus-sdk.umd.min.js"></script>
    <script src="https://momentjs.com/downloads/moment.js"></script>
    <script src="https://momentjs.com/downloads/moment-timezone-with-data.js"></script>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link href="css/styles.css" rel="stylesheet">
</head>

<header class="gl-header">

    <a class="govlab-logo" href="index.html">
        <img id="gl-logo" src="case/images/govlab-temp-logo_white.png" alt="The GovLab">
    </a>
    <a class="govlab-logo" href="index.html">
        <img src="case/images/nesta.png" alt="The GovLab">
    </a>
</header>

<body>
    <div id="home-page" v-cloak>
        <div class="hero testing hero-banner">
            <div class="text">
                <h1>Collective Intelligence</h1>
                <h4>Case Studies</h4>
            </div>
        </div>
        <div class="main-button">
            <a :href="'https://burnes-center.directus.app/assets/' + reportData[0].report.id" class="btn" target="_blank">Download THE REPORT</a>
            <a :href="'https://burnes-center.directus.app/assets/' + reportData[0].guide.id" class="btn" target="_blank">Download the guide</a>
          </div>
        <div class="report-section">
            <div v-html="reportData[0].description">

            </div>
        </div>

        <footer>
            <div class="logo-side">
                <img src="case/images/govlab-temp-logo_white.png">
                <p>The Governance Lab's mission is to improve people's lives by changing the way we govern. Our goal at
                    The GovLab is to strengthen the ability of institutions — including but not limited to governments —
                    and people to work more openly, collaboratively, effectively, and legitimately to make better
                    decisions and solve public problems. We believe that increased availability and use of data, new
                    ways to leverage the capacity, intelligence, and expertise of people in the problem-solving process,
                    combined with new advances in technology and science, can transform governance. We approach each
                    challenge and opportunity in an interdisciplinary, collaborative way, irrespective of the problem,
                    sector, geography, and level of government. For more information, visit thegovlab.org.</p>
            </div>
            <div class="address">
                <h4>CONTACT US</h4>
                <p>The GovLab<br>
                    NYU Tandon School of Engineering<br>
                    2 MetroTech Center, 9th Floor<br>
                    Brooklyn, NY 11201<br>
                    (646) 997-3150<br>
                    info@thegovlab.org
                </p>
            </div>
        </footer>
    </div>
</body>

<script src='https://unpkg.com/vue@2.0.3/dist/vue.js'></script>
<script src="https://unpkg.com/vue-meta/dist/vue-meta.min.js"></script>
<script src="js/scripts.js"></script>

</html>