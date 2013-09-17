// @author Nguyen Hoang Duy, based on Steven Halim's base file
// Defines a Heap object; keeps implementation of Heap internally and interact with GraphWidget to display Heap visualizations

var SuffixTreeWidget = function() {
  var self = this;
  var graphWidget = new GraphWidget();

  /*
   * A: Internal representation of Heap in this object
   * It is a compact 1-based 1-dimensional array (ignoring index 0).
   * The parent/left child/right child can be computed via index manipulation.
   *
   * Elements of A are ObjectPair objects, where first element is the value and the second element is the ID of the vertex SVG corresponding to the value
   */

  /*
   * Edge IDs are the index of the child element, so for example edge A[1]-A[2] will have ID "e2" (edge 2)
   * The edges will be set to not change when vertexes are interchanged
   * This eliminates the need to maintain an Adjacency Matrix / List
   */

  var coord = new Array();
  var A = new Array();
  var amountVertex = 0;
  var amountEdge = 0;

  var stateList = [];
  var edgeGenerator = d3.svg.line()
  .x(function(d){return d.x;})
  .y(function(d){return d.y;})
  .interpolate("linear");
  var mousedown_node = null;
  var mousemove_coor = null;
  var edgeList = [];
  var mousedown_in_progress = false, mousemove_in_progress = false, mouseup_in_progress = false;
  var mousedown_event = null, mousemove_event = null, mouseup_event = null;
  var deleted_vertex_list = [];
  var used_alt = -1;
  var adjMatrix = [], adjList = [];
  var edgeId = 0;


  var Txt='',    // the input text string
    root=null, // root of the suffix tree
    infinity;  // quite a big number
    nForks=0;  // number of branching nodes in the suffix tree
    width = 50;
    height = 30;
    height_offset = 18;
  var suffix_table = new Array(), reverse_suffix_table = new Array();
  var height_level = new Array();
  var draw_data = new Array();
  var processQueue = new Array();
  var fromResultNode = null, toResultNode = null;
  var foundResult = false;
  var cur_LRS_max = '', old_LRS_max ='';
  var LRSMax;
  var LRSMaxEqual = new Array();
  var currentColorNode = -1, currentColorElem = -1;
  var saveEdge = 0;
  var isCanvasClear = true;
  var maxX = 0, maxY = 0;

  mainSvg.style("class", "unselectable");
  
  var projection = d3.geo.albersUsa()
    .scale(1070)
    .translate([MAIN_SVG_WIDTH / 2, MAIN_SVG_HEIGHT / 2]);

  var path = d3.geo.path()
      .projection(projection);

  mainSvg.append("rect")
    .attr("class", "background")
    .attr("width", MAIN_SVG_WIDTH)
    .attr("height", MAIN_SVG_HEIGHT)
    .on("click", clicked);

  var g = mainSvg.append("g");

  function getCircleLineIntersectionPoint(x1, y1, x2, y2, r, cx, cy) {
    var baX = x2 - x1; //pointB.x - pointA.x;
    var baY = y2 - y1; //pointB.y - pointA.y;
    var caX = cx - x1; //center.x - pointA.x;
    var caY = cy - y1; //center.y - pointA.y;

    var a = baX * baX + baY * baY;
    var bBy2 = baX * caX + baY * caY;
    var c = caX * caX + caY * caY - r * r;

    var pBy2 = bBy2 / a;
    var q = c / a;
    
    var disc = pBy2 * pBy2 - q;
    var tmpSqrt = Math.sqrt(disc);
    var abScalingFactor1 = -pBy2 + tmpSqrt;
    var abScalingFactor2 = -pBy2 - tmpSqrt;

    var r_x1 = x1 - baX * abScalingFactor1;
    var r_y1 = y1 - baY * abScalingFactor1
    //Point p1 = new Point(pointA.x - baX * abScalingFactor1, pointA.y
    //      - baY * abScalingFactor1);
    var r_x2 = x1 - baX * abScalingFactor2;
    var r_y2 = y1 - baY * abScalingFactor2

    //Point p2 = new Point(pointA.x - baX * abScalingFactor2, pointA.y
    //       - baY * abScalingFactor2);
    var res = new Array();
    res[0] = r_x1; 
    res[1] = r_y1;
    res[2] = r_x2;
    res[3] = r_y2 ;
    return res;
  }

  function moveCircle(x, y, class_id) {
    mainSvg.selectAll(".v" + class_id)
    .attr("cx", x)
    .attr("cy", y);
    
    
    var b = mainSvg.selectAll(".v" + class_id);
    b[0] = b[0].splice(2,1);
    b.attr("y", y + 3);
    b.attr("x", x);
  
    for (var i=1; i <= Object.size(edgeList); i++) {
      var e = edgeList["#e" + i.toString()];
      if (typeof(e) == "undefined") continue;
      if (e[0] == class_id || e[1] == class_id)
        moveWeightedText(i);
    }     
  }

  function calculateEdge(x1, y1, x2, y2) {
    var pts = getCircleLineIntersectionPoint(x1, y1, x2, y2, 15, x1, y1);
    var pts2 = getCircleLineIntersectionPoint(x1, y1, x2, y2, 15, x2, y2);
    var min = 5000;
    var save1 = 0, save2 = 0;
    for (var i=1; i<=3; i+=2) 
      for (var j=1; j<=3; j+=2) 
      {
        var d = Math.sqrt((pts[i-1]-pts2[j-1])*(pts[i-1]-pts2[j-1]) + (pts[i] - pts2[j])*(pts[i] - pts2[j]));
        if (d < min) {
          min = d;
          save1 = i; save2 = j;
        }
      }
      
      var beginPoint = {"x": pts[save1-1], "y": pts[save1]};
      var endPoint = {"x": pts2[save2-1], "y": pts2[save2]};

      return [beginPoint, endPoint];
    }

  // ax + by = c
  // return coordinate of intersection point
  // if parallel, return [-1,-1]
  function getLinesIntersection(a1, b1, c1, a2, b2, c2) {
    if (a1*b2 - a2*b1 == 0) return [-1, 1];
    return [(c1*b2 - b1*c2)/(a1*b2 - b1*a2), (a1*c2 - c1*a2)/(a1*b2 - b1*a2)];
  }

  // return distance from (x, y) to ax + by + c = 0
  function getDistancePointToLine(x, y, a, b, c) {    
    return (Math.abs(a*x + y*b + c))/Math.sqrt(a*a + b*b);
  }

  // x1 is the origin
  function getStraightLineCoordinate(x1, y1, x2, y2) {
    // intersection with x - y - x1 + y1 = 0
    var intersection = getLinesIntersection(1, 1, x2 + y2, 1, -1, x1 - y1);
    var min = getDistancePointToLine(x2, y2, 1, -1, -x1 + y1);
    var save = intersection;
    // intersection with x + y - x1 - y1 = 0
    intersection = getLinesIntersection(-1, 1, -x2 + y2, 1, 1, x1 + y1);
    var dist = getDistancePointToLine(x2, y2, 1, 1, -x1 - y1);
    if (min > dist) {
      min = dist;
      save = intersection;
    }
    // intersection with x - x1 = 0
    intersection = getLinesIntersection(0, 1, y2, 1, 0, x1);
    dist = getDistancePointToLine(x2, y2, 1, 0, -x1);
    if (min > dist) {
      min = dist;
      save = intersection;
    }
    // intersection with y - y1 = 0
    intersection = getLinesIntersection(-1, 0, -x2, 0, 1, y1);
    dist = getDistancePointToLine(x2, y2, 0, 1, -y1);
    if (min > dist) {
      min = dist;
      save = intersection;
    }
    return save;
  }

  this.getGraphWidget = function() { return graphWidget; }
  
  this.getAmountVertex = function() {
    return amountVertex;
  }

  this.getAmountEdge = function() {
    return amountEdge;
  }

  function dist2P(x1, y1, x2, y2) {
    return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
  }

  // return the circle class id if is inside the circle
  // return -1 if free
  function isUsed(x,y) {
    var i,j;
    for (i=1; i<amountVertex; i++) {
      if (dist2P(x, y, coord[i][0], coord[i][1]) <= 35)
       return i;
   }
   return -1;
  }

  function resetEverything() {
    coord = new Array();
    A = new Array();
    amountVertex = 0;
    amountEdge = 0;

    stateList = [];
    edgeGenerator = d3.svg.line()
    .x(function(d){return d.x;})
    .y(function(d){return d.y;})
    .interpolate("linear");
    mousedown_node = null;
    mousemove_coor = null;
    edgeList = [];
    mousedown_in_progress = false, mousemove_in_progress = false, mouseup_in_progress = false;
    mousedown_event = null, mousemove_event = null, mouseup_event = null;
    deleted_vertex_list = [];
    used_alt = -1;
    adjMatrix = [], adjList = [];
    edgeId = 0;

    Txt='',    // the input text string
    root=null, // root of the suffix tree
    infinity;  // quite a big number
    nForks=0;  // number of branching nodes in the suffix tree
    width = 50;
    height = 30;
    height_offset = 18;
    suffix_table = new Array(), reverse_suffix_table = new Array();
    height_level = new Array();
    draw_data = new Array();
    processQueue = new Array();
    fromResultNode = null, toResultNode = null;
    foundResult = false;
    cur_LRS_max = '', old_LRS_max ='';
    LRSMax;
    LRSMaxEqual = new Array();
    currentColorNode = -1, currentColorElem = -1;
    saveEdge = 0;
    isCanvasClear = true;
    maxX = 0, maxY = 0;
  }

  function clearScreen() {
    var i;

    // remove edges first
    for (i = 1; i <= amountEdge; i++){
      graphWidget.removeEdge(i);
    }

    // remove vertices after removing edges
    for (i = 1; i < amountVertex; i++){
      graphWidget.removeVertex(A[i].getSecond());
    }

    mainSvg.selectAll(".edgelabel").remove();
    mainSvg.selectAll("text").remove();
    amountVertex = 0;
    resetEverything();
  }  

  // Javascript addon: get size of an object
  Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) size++;
    }
    return size;
  };

  function addIndirectedEdge(vertexClassA, vertexClassB, edgeIdNumber, type, weight, show) {
    graphWidget.addEdge(vertexClassA, vertexClassB, edgeIdNumber, type, weight, show);
    var edgeId = "#e" + edgeIdNumber.toString();
    edgeList[edgeId.toString()] = [vertexClassA, vertexClassB];
  }

  function createAdjMatrix() {
    var vertex_count = getNextVertexId() - 1;
    adjMatrix = new Array(vertex_count);
    for (var i = 0; i < vertex_count; i++) {
      adjMatrix[i] = new Array(vertex_count);
      for (var j=0; j < vertex_count; j++)
        adjMatrix[i][j] = 0;
    }

    var tmp = "#e";
    for (var i=1; i <= Object.size(edgeList); i++) {
      var edge_id = tmp + i.toString();
      if (mainSvg.select(edge_id).attr("style"))
        if (mainSvg.select(edge_id).attr("style").indexOf("hidden") != -1) continue;
      var from_vertex_id = edgeList[edge_id][0];
      var target = mainSvg.selectAll(".v" + from_vertex_id.toString());
      var from_vertex_content = target[0][2].textContent;

      var to_vertex_id = edgeList[edge_id][1];
      if (from_vertex_id == to_vertex_id) continue;

      target = mainSvg.selectAll(".v" + to_vertex_id.toString());
      var to_vertex_content = target[0][2].textContent;       

      if (document.getElementById("weighted_checkbox").checked) {
        var weight = document.getElementById("w_e"+ i.toString());
        adjMatrix[parseInt(from_vertex_content)][parseInt(to_vertex_content)] = (weight == null) ? 1 : weight.textContent;
        if (!document.getElementById("direct_checkbox").checked) 
          adjMatrix[parseInt(to_vertex_content)][parseInt(from_vertex_content)] = (weight == null) ? 1 : weight.textContent;       
      } else {
        adjMatrix[parseInt(from_vertex_content)][parseInt(to_vertex_content)] = 1;        
        if (!document.getElementById("direct_checkbox").checked) 
          adjMatrix[parseInt(to_vertex_content)][parseInt(from_vertex_content)] = 1;           
      }
    }
    var xv = 1;
    drawAdjMatrix();
  }

  function pair(a, b) { this.fst = a; this.snd = b; } // i.e. <fst, snd>
// NB. most of Ukkonen's functions return a pair (s,w)


  function isEmptyStrng() { return this.right < this.left; }

  function Strng(left, right) // represents Txt[left..right]
  { this.left=left; this.right=right;
   this.isEmpty = isEmptyStrng;
  }//constructor


  function addTrnstn(left, right, s) // this['a'] >---(left..right)---> s
  // add a transition to `this' state
  { this[Txt.charAt(left)] = new pair(new Strng(left,right), s);
   this.isLeaf = false;
  }

  function State() // i.e. a new leaf node in the suffix tree
  { this.addTransition = addTrnstn; this.isLeaf = true; }

  function Node(word, x, y) {
    this.word = word;
    this.x = x;
    this.y = y;
  }

  function stringCmp(a, b) {
    for (var i=0; i<Math.min(a.length, b.length); i++) {
      if (a[i] < b[i]) return 1;
      else if (a[i] > b[i]) return -1;
    }
    if (a.length == b.length) return 0;
    else if (a.length > b.length) return -1;
    return 1;
  }

  function Node2(word, index) {
    this.word = word;
    this.index = index;
  }

  function Node3(word, suffix_index, parent_index, x, y, path_label, class_id, color)  {
    this.word = word;
    this.suffix_index = suffix_index;
    this.parent_index = parent_index;
    this.x = x;
    this.y = y;
    this.path_label = path_label;
    this.class_id = class_id;
    if (typeof(color)=='undefined') this.color = 'black';
    else this.color = color;
  }

  function Node4(path_label, node_label,  x, y, match_flag) {
    this.path_label = path_label;
    this.node_label = node_label;
    this.x = x;
    this.y = y;
    this.match_flag = match_flag;
  }

  function NodeLRS(path_label, x, y, is_leaf) {
    this.path_label = path_label;
    this.x = x;
    this.y = y;
    this.is_leaf = is_leaf;
  }

  function NodeG(prev_x, isString1, isString2) {
    this.prev_x = prev_x;
    this.isString1 = isString1;
    this.isString2 = isString2;
  }
 
  function upDate(s, k, i)                                                   
  // (s, (k, i-1)) is the canonical reference pair for the active point         
  { 
    var oldr = root;                                                        
    var endAndr = test_and_split(s, k, i-1, Txt.charAt(i))                  
    var endPoint = endAndr.fst; var r = endAndr.snd                         
                                                                           
    while (!endPoint)                                                       
    { r.addTransition(i, infinity, new State());                           
      if (oldr != root) oldr.sLink = r;                                    
                                                                           
      oldr = r;
      var sAndk = canonize(s.sLink, k, i-1)                                
      s = sAndk.fst; k = sAndk.snd;                                        
      endAndr = test_and_split(s, k, i-1, Txt.charAt(i))                   
      endPoint = endAndr.fst; r = endAndr.snd;                             
    }                                                                      
                                                                           
    if(oldr != root) oldr.sLink = s;                                       

    return new pair(s, k);
  }//upDate


  function test_and_split(s, k, p, t) { 
    if(k<=p)                                                                
    { // find the t_k transition g'(s,(k',p'))=s' from s                  
      // k1 is k'  p1 is p'                                                
      var w1ands1 = s[Txt.charAt(k)];          // s --(w1)--> s1            
      var s1 = w1ands1.snd;                                               
      var k1 = w1ands1.fst.left;  var p1 = w1ands1.fst.right;

      if (t == Txt.charAt(k1 + p - k + 1))
         return new pair(true, s);
      else
       { var r = new State()
         s.addTransition(k1, k1+p-k,   r);     // s ----> r ----> s1
         r.addTransition(    k1+p-k+1, p1, s1);
         return new pair(false, r)
       }
    }
    else // k > p;  ? is there a t-transition from s ?
    return new pair(s[t] != null, s);
  }//test_and_split


  function canonize(s, k, p) { 
    if(p < k) return new pair (s, k);

     // find the t_k transition g'(s,(k',p'))=s' from s
     // k1 is k',  p1 is p'
     var w1ands1 = s[Txt.charAt(k)];                            // s --(w1)--> s1
     var s1 = w1ands1.snd;
     var k1 = w1ands1.fst.left;  var p1 = w1ands1.fst.right;

     while(p1-k1 <= p-k)                               // s --(w1)--> s1 ---> ...
      { k += p1 - k1 + 1;                    // remove |w1| chars from front of w
        s = s1;
        if(k <= p)
         { w1ands1 = s[Txt.charAt(k)];                          // s --(w1)--> s1
           s1 = w1ands1.snd;
           k1 = w1ands1.fst.left; p1 = w1ands1.fst.right;
         }
       }
      return new pair(s, k);
  }//canonize


  function insertionSort(Txt, second) // NB. O(n**2) or worse; unacceptable for long input strings!
  { //if(Txt.length > 11) return;//too long for sorting
    //var suffixW = document.getElementById('suffixW');
    //suffixW.value = '';
    var table = document.getElementById('myTable');
    var A = new Array(), len = Txt.length;
    //cleanup();
    var i;
    for(i = 0; i < Txt.length; i++) A[i] = i;
    for(i = 0; i < Txt.length-1; i++)
    { var j,  small = i;
      for(j = i+1; j < Txt.length; j++)
         if(Txt.substring(A[j],len) < Txt.substring(A[small], len))
            small = j;
      var temp = A[i]; A[i] = A[small]; A[small] = temp;
    }
    for(i = 0; i < len; i++)
    { var numbr = '    '+(A[i])+': ';
      numbr = numbr.substring(numbr.length-4, numbr.length);
      //document.theForm.opt.value += numbr+Txt.substring(A[i], len)+'\n';
      suffix_table[A[i]] = Txt.substring(A[i], len);
      reverse_suffix_table[Txt.substring(A[i], len)] = A[i];
    }   
    for (i=0; i < suffix_table.length-1; i++) {
      for (var j=i+1; j< suffix_table.length; j++) {
        if (suffix_table[i] > suffix_table[j]) {
          var tmp = suffix_table[i];
          suffix_table[i] = suffix_table[j];
          suffix_table[j] = tmp;
        }
      }   
    }
    /*
    for (i=0; i < suffix_table.length; ++i) {
      var $input = $('<tr><td height=20px>' + i + '</td>' +  ' <td>' + reverse_suffix_table[suffix_table[i]] + '</td> ' + '<td>' + suffix_table[i] + '</td> ' + ' </tr>').appendTo(suffixW.getWidget().find('.tb1'));
      //row_draw_data[suffix_table[i]] = i;
    } */
    //document.theForm.opt.value += '\n';
    /*
    var canvas = document.getElementById('canvas');  
    if (typeof(second)!== "undefined") {
    canvas.addEventListener('click', function(evt) {
          var mousePos = getMousePos(canvas, evt);
          //alert(mousePos.x + " " + mousePos.y);
          var message = 'Mouse position: ' + mousePos.x + ',' + mousePos.y;
          insertionSort(Txt);
          highlightFromTreeToArray(mousePos);
        }, false);

    $('.vertices').css('pointer-events','none');  
    $('.edges').css('pointer-events','none');
    $('.overlays').css('pointer-events','none');

    }*/
 }//insertionSort

  function algorithm2() { 
    var s, k, i;
    var bt;

    root = new State();
    bt = new State();                                      // bt (bottom or _|_)

    // Want to create transitions for all possible chars
    // from bt to root
    for (i=0; i<Txt.length; i++)
      bt.addTransition(i,i, root);

    root.sLink = bt;
    s=root; k=0;  // NB. Start k=0, unlike Ukkonen paper our strings are 0 based

    for(i=0; i < Txt.length; i++)
    { var sAndk = upDate(s, k, i);   // (s,k) < - upDate(...)
      s = sAndk.fst; k = sAndk.snd;
      sAndk = canonize(s, k, i);     // (s,k) < - canonize(...)
      s = sAndk.fst; k = sAndk.snd;
    }
  }//algorithm2 

  this.showGATAGACA = function() {
    clearScreen();
    stDriver();
  }

  this.buildSuffixTree = function(txt) {
    clearScreen();
    Txt = txt;
    stDriver();
  }

  function stDriver(second)
  { //Txt = document.theForm.inp.value;
    //Txt = "GATAGACA$";
    if (Txt.length == 0) {
      alert("Please enter a non-empty string");
      return
    }
    if (Txt[Txt.length-1] != '$') {
      alert("$ has been appended to your string");
      Txt += '$';
      document.getElementById("s").value = Txt;
    }
    infinity = Txt.length + 1000; // well it's quite big :-)
    nForks = 0;
    draw_data = new Array();
    //document.theForm.opt.value = '';
    suffix_table = new Array();
    reverse_suffix_table = new Array();
    currentColorNode = -1;
    currentColorElem = -1;
    insertionSort(Txt);

    algorithm2();  // ------------ the business
    height_level = new Array();
    for (var i=0; i < Txt.length; i++) height_level[i] = 0;
    //show(root, '', 'tree:|', 0, '');
    //document.theForm.opt.value += nForks + ' branching nodes';
    height = Txt.length*32;

    /*
    var ctx = document.getElementById("canvas").getContext("2d");
    ctx.clearRect(0, 0, 3000, 3000);

    ctx.save();
    */
    height_level[0] = height_offset ;
    for (var i=1; i < Txt.length; i++) {
        height_level[i] = height_level[0]*i*5.5;
    }   
    maxY = 0; maxX = 0;
    // TODO:
    drawSuffixTree(root, 0, 70, '');
    // TODO:
    drawAllLabel();
  }//stDriver

  function drawSuffixTree(T, level, prev_x, text) {
    var count = 0, iter=0;
    for (attr in T) {
      if (attr.length == 1) count++;
    }   

    var used = new Array(), min = '';
    for (attr in T) 
      if (attr.length == 1) {
        var wAndT2 = T[attr];
        var w = wAndT2.fst;
        var myStr = Txt.substring(w.left, w.right+1);
        used.push(new Node2(myStr, attr));
      }
    for (var i=0; i<used.length-1; i++)
      for (var j=i+1; j<used.length; j++) {
        if (stringCmp(used[i].index, used[j].index) == -1 ) {
          var tmp = used[i];
          used[i] = used[j];
          used[j] = tmp;
        }       
        else if (stringCmp(used[i].index, used[j].index) == 0) {
          if (stringCmp(used[i].word, used[j].word) == -1) {
            var tmp = used[i];
            used[i] = used[j];
            used[j] = tmp;
          }         
        }
      }

    var update_prev_x = prev_x;
    var tmp_store = text.split(":");
    var T_idx = text, T_string = text;
    //for(attr in T)//each subtree
      //if(attr.length == 1)//a char attribute selects a suffix-tree branch
    for (var i=0; i < used.length; i++) {
      iter++;//ics pmoc hsanom
      var attr = used[i];
      if (iter>count/2) break; 
      var wAndT2 = T[attr.index];
      var w = wAndT2.fst, T2 = wAndT2.snd;
      var Str_idx = Txt.substring(w.left, w.right+1);
      var myStr = T_string+ Str_idx ;
      //height = height_level[level];
      var y = (level+1)*height + height_offset;
      //drawVertex(update_prev_x,y,myStr,'black');
      var suffix_idx = -1;
      if (reverse_suffix_table[T_string + Str_idx]) {
        suffix_idx = reverse_suffix_table[T_string + Str_idx];
      }
      draw_data[T_string + Str_idx] = new Node3(T_string + Str_idx, suffix_idx, T_idx, 0, 0, T_string + Str_idx);
      update_prev_x = Math.max(update_prev_x, drawSuffixTree(T2, level+1, update_prev_x, myStr));
    }    
    update_prev_x += width;
    var vertex_name = "";
    if (reverse_suffix_table[text] || reverse_suffix_table[text] === 0) vertex_name = reverse_suffix_table[text];
    height = height_level[level];
    if (maxX < update_prev_x) maxX = update_prev_x;
    if (maxY < height) maxY = height;

    //drawVertex(update_prev_x, height, vertex_name, 'black'); TODO:
    A[amountVertex] = new ObjectPair(vertex_name, amountVertex);
    graphWidget.addVertex(update_prev_x, height, A[amountVertex].getFirst(), A[amountVertex++].getSecond(), true);
    if (T_idx == "") {
      draw_data[""] = new Node3(T_string, -1, -2, update_prev_x, level*height + height_offset, "", amountVertex -1);
    } else {
      draw_data[T_idx].x = update_prev_x;
      draw_data[T_idx].y = height;
      draw_data[T_idx].class_id = amountVertex -1;
    }
    iter = 0;
    for (var i=0; i < used.length; i++) 
     { iter++;
       if (iter>count/2) {
         var attr = used[i];
         var wAndT2 = T[attr.index];
         var w = wAndT2.fst, T2 = wAndT2.snd;
         var Str_idx = Txt.substring(w.left, w.right+1);
         //if (Str_idx.indexOf("#") > -1) 
         //Str_idx = Str_idx.substring(0, Str_idx.indexOf("#")+1);
         var myStr = T_string + Str_idx;
         //show(T2, str2, myStr);
         var y = (level+1)*height + height_offset;
         //drawVertex(update_prev_x,y,myStr,'black');
         var suffix_idx = -1;
         if (reverse_suffix_table[T_string + Str_idx]) {
            suffix_idx = reverse_suffix_table[T_string + Str_idx];
         }
         draw_data[T_string + Str_idx] = new Node3(T_string + Str_idx, suffix_idx, T_idx, 0, 0, T_string + Str_idx);
         update_prev_x = Math.max(update_prev_x, drawSuffixTree(T2, level+1, update_prev_x, myStr));
       }
     }   
    return update_prev_x;
  }

  function drawAllLabel() {
    var node;
    for (attr in draw_data) {
      if (attr == "") continue;
      node = draw_data[attr];
      if (typeof(node.parent_index) != 'undefined') {
        var tmp = draw_data[node.parent_index];
        var a = node.path_label, b = tmp.path_label, c="", i;
        if (b) {
          for (i = 0; i < a.length; i++) {
            if (a[i] != b[i]) break;
          }
          for (; i < a.length; i++) {
            c += a[i];
          }
        } else c = a;
        var pts = getCircleLineIntersectionPoint(tmp.x, tmp.y, node.x, node.y, 14, tmp.x, tmp.y);
        var pts2 = getCircleLineIntersectionPoint(tmp.x, tmp.y, node.x, node.y, 14, node.x, node.y);
        var min = 5000;
        var save1 = 0, save2 = 0;
        for (var i=1; i<=3; i+=2) 
          for (var j=1; j<=3; j+=2) 
        {
          if (Math.abs(pts[i] - pts2[j]) < min) {
            min = Math.abs(pts[i] - pts2[j]);
            save1 = i; save2 = j;
          }
        }

        drawLabel(tmp.class_id, node.class_id, pts[save1-1], pts[save1], pts2[save2-1], pts2[save2], c, node.color);
        //drawLabel(tmp.x, tmp.y, node.x, node.y, c, node.color);   
        //drawLabel(pts[save1-1], pts[save1], pts2[save2-1],pts2[save2],c, node.color);
      }
    }
  }

  function drawLabel(from_class_id, to_class_id, xA, yA, xB, yB, text, color) {
    graphWidget.addEdge(from_class_id, to_class_id, ++amountEdge, EDGE_TYPE_UDE, 1, true);
    mainSvg.select("#e" + (amountEdge).toString()).attr("style", "stroke-width:0.5");
    var slope = (yA - yB)/(xA - xB);
    var x0 = xA, y0 = 0;
    var b = (yA - slope*xA);
    var deltaX = xA - xB;
    var delta = deltaX/(text.length+1);
    for (var i=0; i<text.length; i++) {
      x0-=delta;
      y0=slope*x0 + b;
      //ctx.fillText(text[i],x0,y0);
      mainSvg
     .append("text")
     .attr("class", "edgelabel")
     .attr("x", x0)
     .attr("y", y0)
     .attr("dx", 1)
     .attr("dy", ".35em")
     .attr("text-anchor", "middle")     
     .text(function(d) { return text[i] });
    }

  }


  function clicked(d) {
    return;
    var cur = d3.mouse(this);
    mainSvg.selectAll(".edgelabel")
      .style("pointer-events", "none")
    .transition()
      .duration(750)
      .attr("transform", "translate(80,80)");

    if (!d || centered === d) {
    projection.translate([MAIN_SVG_WIDTH / 2, MAIN_SVG_HEIGHT / 2]);
    centered = null;
  } else {
    var centroid = path.centroid(d),
        translate = projection.translate();
    projection.translate([
      translate[0] - centroid[0] + MAIN_SVG_WIDTH / 2,
      translate[1] - centroid[1] + MAIN_SVG_HEIGHT / 2
    ]);
    centered = d;
  }

  // Transition to the new projection.
  g.selectAll("path").transition()
      .duration(750)
      .attr("d", path);
  }

}