import Map from 'ol/Map.js';
import View from 'ol/View.js';
import { Draw, Modify } from 'ol/interaction.js';
import { OSM, Vector as VectorSource } from 'ol/source.js';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer.js';
import { get } from 'ol/proj.js';
import Overlay from 'ol/Overlay.js';
import { Circle, LineString, Polygon } from 'ol/geom.js';
import { getArea, getLength } from 'ol/sphere.js';
import { unByKey } from 'ol/Observable.js';
import GeoJSON from 'ol/format/GeoJSON';
import { defaults as defaultControls } from 'ol/control.js';
import MousePosition from 'ol/control/MousePosition.js';
import DragAndDrop from 'ol/interaction/DragAndDrop.js';
// import { GeoJSON} from 'ol/format.js';

const mousePositionControl = new MousePosition({
  projection: 'EPSG:4326',
  className: 'custom-mouse-position',
  target: document.getElementById('mouse-position'),
});
const raster = new TileLayer({
  source: new OSM(),
});

const source = new VectorSource();
const vector = new VectorLayer({
  source: source,
  style: {
    'fill-color': 'rgba(255, 255, 255, 0.2)',
    'stroke-color': '#ffcc33',
    'stroke-width': 2,
    'circle-radius': 7,
    'circle-fill-color': '#ffcc33',
  },
});

let sketch;
let measureTooltipElement;
let measureTooltip;
const extent = get('EPSG:3857').getExtent().slice();
extent[0] += extent[0];
extent[2] += extent[2];
const map = new Map({
  controls: defaultControls().extend([mousePositionControl]),
  layers: [raster, vector],
  target: 'map',
  view: new View({
    center: [0, 0],
    zoom: 4,
    extent,
  }),
});

const formatLength = function (line) {
  const length = getLength(line);
  let output;
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + ' ' + 'km';
  } else {
    output = Math.round(length * 100) / 100 + ' ' + 'm';
  }
  return output;
};

const formatArea = function (polygon) {
  const area = getArea(polygon);
  let output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + ' ' + 'km<sup>2</sup>';
  } else {
    output = Math.round(area * 100) / 100 + ' ' + 'm<sup>2</sup>';
  }
  return output;
}

const modify = new Modify({ source: source });
map.addInteraction(modify);

let draw, snap; // global so we can remove them later
const typeSelect = document.getElementById('type');

function addInteractions() {
  draw = new Draw({
    source: source,
    type: typeSelect.value,
  });
  map.addInteraction(draw);
  createMeasureTooltip();

  // createHelpTooltip();
  let listener;
  draw.on('drawstart', function (evt) {
    // set sketch
    sketch = evt.feature;
    console.log(sketch);
    let tooltipCoord = evt.coordinate;
    listener = sketch.getGeometry().on('change', function (evt) {
      const geom = evt.target;
      const coordinate = geom.getCoordinates();
      let output;
      if (geom instanceof Polygon) {
        output = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
      }
      else if (geom instanceof LineString) {
        output = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      else if (geom instanceof Circle) {
        const radius = geom.getRadius();
        const area = Math.PI * Math.pow(radius / 1000, 2);
        output = Math.round(area * 100) / 100 + ' ' + 'km<sup>2</sup>';
        tooltipCoord = geom.getCenter();
      }
      measureTooltipElement.innerHTML = output;
      measureTooltip.setPosition(tooltipCoord);
    })
  })
  draw.on('drawend', function (event) {
    measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
    measureTooltip.setOffset([0, -7]);
    sketch = null;
    measureTooltipElement = null;
    createMeasureTooltip();
    unByKey(listener);
    const feature = event.feature;
    console.log(feature);
    openForm(feature);
  });
}
// Function to calculate measure values
function calculateMeasureValues(feature) {
  const geometry = feature.getGeometry();
  let output;
  let tooltipCoord;

  if (geometry instanceof Polygon) {
    output = formatArea(geometry);
    tooltipCoord = geometry.getInteriorPoint().getCoordinates();
  } else if (geometry instanceof LineString) {
    output = formatLength(geometry);
    tooltipCoord = geometry.getLastCoordinate();
  } else if (geometry instanceof Circle) {
    const radius = geometry.getRadius();
    const area = Math.PI * Math.pow(radius / 1000, 2);
    output = Math.round(area * 100) / 100 + ' ' + 'km<sup>2</sup>';
    tooltipCoord = geometry.getCenter();
  }

  return { output, tooltipCoord };
}

modify.on('modifystart', function (e) {
  measureTooltipElement.innerHTML = '';
  e.features.forEach(function (feature) {
    const { output, tooltipCoord } = calculateMeasureValues(feature);
    measureTooltipElement.innerHTML += output; // Append to existing content
    measureTooltip.setPosition(tooltipCoord);
  });
});
modify.on('modifyend', function (e) {
  measureTooltipElement.innerHTML = '';

  e.features.forEach(function (feature) {
    const { output, tooltipCoord } = calculateMeasureValues(feature);
    measureTooltipElement.innerHTML += output;
    measureTooltip.setPosition(tooltipCoord);
  });

  measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
  measureTooltip.setOffset([0, -7]);
});


// Creating measure tooltip whenever new layer is created
function createMeasureTooltip() {
  if (measureTooltipElement) {
    measureTooltipElement.parentNode.removeChild(measureTooltipElement);
  }
  measureTooltipElement = document.createElement('div');
  measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
  measureTooltip = new Overlay({
    element: measureTooltipElement,
    offset: [0, -15],
    positioning: 'bottom-center',
    stopEvent: false,
    insertFirst: false,
  });
  map.addOverlay(measureTooltip);
}

function openForm(feature) {
  const form = document.createElement('form');
  form.innerHTML = `
    <label>Id:</label> <br>
    <input type="number" name="id" id='id' required> <br>
    <label>Name:</label> <br>
    <input type="text" name="name" required> <br>
    <label>Description:</label> <br>
    <input type="text" name="Desc" required> <br>
    <label>Measure</label> <br>
    <input type="text" name="Measure" required>
    <button type="submit" >Submit</button>
   `;
  form.addEventListener('submit', (event) => handleSubmit(event, feature));
  const formContainer = document.createElement('div');
  // const formContainer = document.getElementById('form-container');
  formContainer.className = 'form-container'
  formContainer.style.zIndex = '1000';
  formContainer.appendChild(form);

  map.getViewport().appendChild(formContainer);

  form.id.focus();
}
// Function to handle form submission for each feature
function handleSubmit(event, feature) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const attributes = {};
  for (const [key, value] of formData.entries()) {
    attributes[key] = value;
  }
  feature.setProperties(attributes);
  event.target.parentNode.remove();
  const tableBody = document.querySelector('#list tbody');
  const newRow = document.createElement('tr');
  newRow.innerHTML = `
    <td>${attributes['id']}</td>
    <td>${attributes['name']}</td>
    <td>${attributes['Desc']}</td>
    <td>${attributes['Measure']}</td>
    <td><button class="editBtn">Edit</button></td>
  `;
  tableBody.appendChild(newRow);
}


document.querySelector('#list tbody').addEventListener('click', (event) => {
  if (event.target.classList.contains('editBtn')) {
    const row = event.target.parentNode.parentNode;
    const id = row.cells[0].textContent;
    const name = row.cells[1].textContent;
    const desc = row.cells[2].textContent;
    const measure = row.cells[3].textContent;
    // Using Prompt to edit the data
    const newName = prompt('Enter new Name:', name);
    const newDesc = prompt('Enter new Description:', desc);
    const newMeasure = prompt('Enter new Measure:', measure);
    // Updating the row with the edited data 
    if (newName !== null && newDesc !== null && newMeasure !== null) {
      row.cells[1].textContent = newName;
      row.cells[2].textContent = newDesc;
      row.cells[3].textContent = newMeasure;
      const feature = findFeatureById(id);
      // Updating the feature properties with the new values
      if (feature) {
        feature.setProperties({
          'name': newName,
          'Desc': newDesc,
          'Measure': newMeasure
        });
      }
    }
  }
});
function findFeatureById(id) {
  const features = vector.getSource().getFeatures();
  for (const feature of features) {
    if (feature.getProperties().id === id) {
      return feature;
    }
  }
  // returns null if the given feature id not found
  return null;
}
typeSelect.onchange = function () {
  map.removeInteraction(draw);
  map.removeInteraction(snap);
  addInteractions();
};
addInteractions();
// exporting layers as json
$(".exportBtn").on("click", () => {
  const features = vector.getSource().getFeatures();
  const geoJSONFormat = new GeoJSON();
  const json = geoJSONFormat.writeFeatures(features, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857'
  });
  console.log(json);
  function download(content, fileName, contentType) {
    var a = document.createElement("a");
    var file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  }
  download(json, 'your_layer.geojson', 'text/plain');
});

const handleConvertToShapefile = () => {
  const features = vector.getSource().getFeatures();
  const endpointUrl = 'http://127.0.0.1:5000/convertToShapefile';
  const geojsonFormat = new GeoJSON();
  const geojsonFeatures = geojsonFormat.writeFeaturesObject(features);
  const requestBody = JSON.stringify({ features: geojsonFeatures });
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: requestBody
  };
  fetch(endpointUrl, requestOptions)
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Failed to convert to Shapefile');
    })
    .then(data => {
      console.log(data.message);
    })
    .catch(error => {
      console.error('Error converting to Shapefile:', error);
    });
};
document.getElementById('convertToShapefileBtn').addEventListener('click', handleConvertToShapefile);




