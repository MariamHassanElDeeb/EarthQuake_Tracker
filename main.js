//#region Overall info about out wepsite "Earthquake Tracker"
//Welcome to our earthquake tracking website! Enter a location and we'll take you there using the OpenStreetMap (OSM) geocoding API.
// Then, using the USGS earthquake API, we'll display earthquakes that have occurred near that location, sorted by distance.
// Our website provides information on each earthquake, including distances from your location.
// Click on each earthquake to view additional details, such as Population and Country name.
// We are committed to providing accurate information on earthquakes.
// Our website is updated regularly with the latest data from the USGS earthquake API.
// Thank you for using our earthquake tracking website. We hope it helps keep you informed and safe.
//#endregion
//#region Add OSM Map To the layout
// we created OSM map then we set it default values , to make it ready when opening the web page every time.
let map = new ol.Map({
  layers: [],
  target: "map",
  view: new ol.View({
    center: ol.proj.transform(
      [29.382269692080797, 27.82503961612639],
      "EPSG:4326",
      "EPSG:3857"
    ),
    zoom: 4,
    rorate: true,
    attribution: true,
  }),
});
const osm = new ol.layer.Tile({
  source: new ol.source.OSM(),
  visible: true,
  layerName: "OSM",
});
//#endregion
//#region Add stadia Map To the layout
// we added Stadia Map to the layout so we can use it as dark mode map and switch between it and the OSM map
const stadiamap = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png",
  }),
  layerName: "Stad",
  visible: false,
});
const group = new ol.layer.Group({
  layers: [osm, stadiamap],
});
const popup = new ol.Overlay({
  element: document.getElementById("popup"),
});
//#endregion
//#region Readio Button "Switcher"
//we created this section to switch between OSM and Stadia [Dark Mode & Light Mode]
const radio = document.getElementById("flexSwitchCheckChecked");
stadiamap.setVisible(true);
radio.addEventListener("click", (e) => {
  if (radio.checked) {
    console.log(radio.checked);
    stadiamap.setVisible(false);
    osm.setVisible(true);
  } else {
    console.log(radio.checked);
    stadiamap.setVisible(true);
    osm.setVisible(false);
  }
});
map.addLayer(group);
//#endregion
//#region searchPar for the GeoCodeing
//we created this section to create searchPar and a list beneath so it look like any normal search par,
// and we used OSM GeoCodeing API to handel the search and return the values that === the typed words in the search par
const searchPar = document.querySelector("#searchPar");
const searchList = document.querySelector("#places");
let Feature;
let timeref;
searchPar.addEventListener("input", (e) => {
  let typed = e.target.value;
  clearTimeout(timeref);
  timeref = setTimeout(() => {
    // this setTimeout Function used to give 1Sec between the last letter we typed in the search par and the result showing in the search list
    let RecData = GeoCode(typed); //here we use the GeoCode function to get the similar values in the API to our search keywords the we typed in the search par
    RecData.then((data) => {
      searchList.innerHTML = "";
      data.features.forEach((Feature) => {
        let name = Feature.properties.display_name;
        let li = document.createElement("li");
        li.id = Feature.properties.osm_id;
        li.addEventListener("click", (e) => {
          MakelistClickable(Feature);
        });
        li.innerHTML = name;
        searchList.append(li);
      });
    });
  }, 1000);
});

document.addEventListener("click", (e) => {
  // this Event listener is to close the search list if we clicked any where in the page out of the search list
  const isClickInsideSearchBox = searchPar.contains(e.target);
  const isClickInsidePlacesList = searchList.contains(e.target);
  if (!isClickInsideSearchBox && !isClickInsidePlacesList) {
    searchList.style.display = "none";
  } else {
    searchList.style.display = "block";
  }
});
//#endregion
//#region the GeoCodeing API Section
// for the GeoCode functionality we used OSM GeoCodeing API to handel our requests
function GeoCode(Search) {
  return fetch(
    `https://nominatim.openstreetmap.org/search?q=${Search}&format=geojson`
  )
    .then((res) => res.json())
    .then((data) => {
      return data;
    });
}
let BufferLayer = new ol.layer.Vector({});
// here we add a funcion to make the Search list clickable, and we created it here to take the response data from the API
// and display it in the list with clickaple feature so by cliking the result we can display it on the map
// and in this function we add a buffer so we can use it do show the search area on the map
function MakelistClickable(features) {
  map.removeLayer(BufferLayer); // we remove the old buffer with each new search and add the new one, so the map view only contain one search result
  Feature = features.geometry.coordinates;
  let coords = ol.proj.transform(Feature, "EPSG:4326", "EPSG:3857");
  map.getView().animate({ zoom: 5 }, { center: coords });
  Earthquakes(Feature);
  let bufferPoint = new ol.Feature({
    geometry: new ol.geom.Point(coords),
  });
  BufferLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [bufferPoint],
    }),
    style: function (feature, resolution) {
      return new ol.style.Style({
        image: new ol.style.Circle({
          radius: 400000 / resolution,
          stroke: new ol.style.Stroke({ color: "#a4a6a550", width: 8 }),
          fill: new ol.style.Fill({ color: "#a4a6a550" }),
        }),
      });
    },
  });
  map.addLayer(BufferLayer);
}
//#endregion
//#region the Earthquakes API Section & Cluster Section

let vectorLayer = new ol.layer.Vector({
  source: new ol.source.Vector(),
});
let size;
let clusterSource;

let clusterLayer = new ol.layer.Vector({
  // we made the cluster Vector layer Global variable so we can remove it with every search result we show on the map.
  source: new ol.source.Vector(),
});
let singleFeatureLayer = new ol.layer.Vector({
  // this single feature vector layer is made to show the single earthquake when to reach its zoom level along with the cluster layer
  source: new ol.source.Vector(),
});
// in this section we used USGS Earthquakes API to handel our search for the Earthquakes in specific area.
function Earthquakes(Feature) {
  fetch(
    `https://earthquake.usgs.gov/ws/geoserve/places.json?latitude=${Feature[1]}&longitude=${Feature[0]}&maxradiuskm=300&type=geonames`
  )
    .then((res) => res.json())
    .then((data) => {
      map.removeLayer(clusterLayer); // we remove the old cluster with each new search and add the new one so the map view only contain one search result
      map.removeLayer(singleFeatureLayer);
      var textFill = new ol.style.Fill({
        color: "#000000",
      });
      var textStroke = new ol.style.Stroke({
        color: "rgba(0, 0, 0, 0.1)",
        width: 1,
      });
      var singleFeatureStyle = function (data) {
        size = data.get("features").length;

        if (size == 1) {
          // the condition to show the single feature when we reach its zoom level,
          // and give it a style depend on its distance from from the Earthquake center.
          LegendFunc(data);
          var fillColor;
          var radius;
          var width;
          if (data.values_.features[0].values_.Earthquakedistance < 50) {
            // in this condition we make the highest risk to the distand below 50 KM from the Earthquake center.
            fillColor = "#ab070760";
            radius = 18;
            width = 40;
          } else if (
            // in this condition we make the Middel risk to the distand above 50 KM and below 100 KM from the Earthquake center.
            data.values_.features[0].values_.Earthquakedistance > 50 &&
            data.values_.features[0].values_.Earthquakedistance < 100
          ) {
            fillColor = "#f59e4260";
            radius = 12;
            width = 25;
          } else {
            // and for the rest of the results we gave the lowest risk, and they will be more than 100 KM from the Earthquake center.
            fillColor = "#0b852360";
            radius = 9;
            width = 15;
          }
          return new ol.style.Style({
            image: new ol.style.Circle({
              radius: radius,
              fill: new ol.style.Fill({
                color: fillColor,
              }),
              stroke: new ol.style.Stroke({
                color: fillColor,

                width: width,
              }),
            }),
          });
        }
      };
      function styleFunction(data) {
        // this style function is to gave a specific style to the clustered feature so it seem bigger with highest earthquake density in eash area.
        var style;
        var features = vectorLayer.getSource().getFeatures();
        size = data.get("features").length;
        let radius = Math.max(10, Math.min(size * 0.75, 20)); // by this equation we made the radius variable with the earthquake density in eash area.
        if (features.length > 1) {
          style = [
            new ol.style.Style({
              image: new ol.style.Circle({
                radius: radius,
                fill: new ol.style.Fill({
                  color: "#96e5ff80",
                }),
                stroke: new ol.style.Stroke({
                  color: "#96e5ff30",
                  width: 6,
                }),
              }),
              text: new ol.style.Text({
                text: size.toString(),
                scale: 1.1,
                fill: textFill,
                stroke: textStroke,
              }),
            }),
          ];
          return style;
        }
      }
      let newFeatures = CreateFeatures(data);
      let mapSource = new ol.source.Vector({
        features: newFeatures,
      });
      clusterSource = new ol.source.Cluster({
        distance: 50,
        minDistance: 10,
        source: mapSource,
      });
      singleFeatureLayer = new ol.layer.Vector({
        source: clusterSource,
        style: singleFeatureStyle,
        zIndex: 2,
      });
      clusterLayer = new ol.layer.Vector({
        source: clusterSource,
        style: styleFunction,
      });
      // we added the clusterd feature and the single feature to the map so we can show eash with its style and zoom level
      map.addLayer(clusterLayer);
      map.addLayer(singleFeatureLayer);
    });
}
//#endregion
//#region the Legend function Section
// we added a Map Legend to the map and we made it dynamic so we can show the feature when they show up on the map
function LegendFunc(data) {
  var extent = map.getView().calculateExtent(map.getSize());
  data.values_.features.forEach((Feature) => {
    console.log(Feature.values_.Earthquakedistance);
    if (Feature.values_.Earthquakedistance < 50) {
      document.getElementById("legend").style.display = "block";
      document.getElementById("red").style.display = "inline-block";
    }
    if (
      Feature.values_.Earthquakedistance >= 50 &&
      Feature.values_.Earthquakedistance < 100
    ) {
      document.getElementById("legend").style.display = "block";
      document.getElementById("orange").style.display = "inline-block";
    }
    if (Feature.values_.Earthquakedistance >= 100) {
      document.getElementById("legend").style.display = "block";
      document.getElementById("green").style.display = "inline-block";
    }
  });
}
//#endregion
//#region Create the Single feature Earthquake point
// in this function we catched the Earthquake API response and created a feature points that holds the data we want to displayes points to have
// as the Country Name and state name and population of where the earthquake that happend near of it.
let EarthquakePoint;
function CreateFeatures(data) {
  let features = [];
  data.geonames.features.forEach((feature) => {
    let point = [
      feature.geometry.coordinates[0],
      feature.geometry.coordinates[1],
    ];
    let points = ol.proj.transform(point, "EPSG:4326", "EPSG:3857");
    EarthquakePoint = new ol.Feature({
      geometry: new ol.geom.Point(points),
      style: new ol.style.Style({
        fill: new ol.style.Fill({
          color: "rgba(255, 255, 255, 0.2)",
        }),
        stroke: new ol.style.Stroke({
          color: "rgba(0, 0, 0, 0.5)",
          lineDash: [10, 10],
          width: 2,
        }),
        image: new ol.style.Circle({
          radius: 5,
          stroke: new ol.style.Stroke({
            color: "rgba(0, 0, 0, 0.7)",
          }),
          fill: new ol.style.Fill({
            color: "rgba(255, 255, 255, 0.2)",
          }),
        }),
      }),
      CountryName: feature.properties.country_name,
      GovernorateName: feature.properties.name,
      Governoratepopulation: feature.properties.population,
      Earthquakedistance: feature.properties.distance,
    });
    features.push(EarthquakePoint);
    vectorLayer.getSource().addFeature(EarthquakePoint);
  });
  return features;
}
//#endregion
//#region Popup for each Feature.
// in this section we add a popup to the map by add an Event Listener to the map and give us the data for each pixil we click
// so by this click we can know if this feature is a cluster or a single feature, and take the data within this feature
// and push it as inner html and display it to the user, so he can get the info that he need from his search
map.on("click", (e) => {
  let isClusterClicked = false;
  let isFeatureClicked = false;

  map.forEachFeatureAtPixel(e.pixel, function (feature) {
    if (feature.values_.features.length > 1) {
      let sum = 0;
      isClusterClicked = true;
      feature.values_.features.forEach((Feature) => {
        sum = sum + Feature.values_.Earthquakedistance;
      });
      let EarthquakedistanceAvg = parseInt(
        sum / feature.values_.features.length
      );
      popup.setPosition(e.coordinate);
      document.getElementById(
        "popup"
      ).innerHTML = `Number OF Earthquakes in this area: ${feature.values_.features.length}<br>The Avareage distances OF Earthquakes in this area: ${EarthquakedistanceAvg} Km`;
    } else if (feature.values_.features.length == 1) {
      isFeatureClicked = true;
      popup.setPosition(e.coordinate);
      document.getElementById(
        "popup"
      ).innerHTML = `CountryName: ${feature.values_.features[0].values_.CountryName}<br>StateName: ${feature.values_.features[0].values_.GovernorateName}<br>StatePopulation: ${feature.values_.features[0].values_.Governoratepopulation}<br>EarthquakeDistance: ${feature.values_.features[0].values_.Earthquakedistance} Km`;
    }
  });

  if (!isClusterClicked && !isFeatureClicked) {
    popup.setPosition(undefined);
  }
});

map.addOverlay(popup);
//#endregion
